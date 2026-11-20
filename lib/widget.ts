import { createHash } from "node:crypto";
import type { McpUiResourceCsp, McpUiResourceMeta } from "@modelcontextprotocol/ext-apps";
import type { ServerContext } from "@modelcontextprotocol/server";
import { baseURL } from "@/baseUrl";

/**
 * The widget's `ui://` resource URI.
 *
 * Hosts treat this as a cache key (ChatGPT caches resource contents for up to
 * an hour). Bump the version when you make a breaking change to the widget's
 * HTML/JS/CSS contract, and keep old URIs working until hosts have moved on.
 */
export const WIDGET_URI = "ui://mcp-apps-nextjs-starter/widget-v1.html";

// ---------------------------------------------------------------------------
// Content Security Policy
//
// Hosts build the iframe's CSP from this and block everything else. Keep it
// to the origins the widget actually uses; add your API/CDN origins here.
// ---------------------------------------------------------------------------

function widgetCsp(host: McpHost): McpUiResourceCsp {
  // Fetches: RSC payloads for client-side navigation (and your route handlers).
  const connectDomains = [baseURL];
  // `next dev` only: the HMR WebSocket (an http(s) source doesn't cover ws(s)).
  if (process.env.NODE_ENV === "development") {
    connectDomains.push(baseURL.replace(/^http/, "ws"));
  }

  // Scripts, styles, images and fonts: the Next.js build output.
  const resourceDomains = [baseURL];
  // Claude's host font (Anthropic Sans), applied by useHostStyles().
  if (host === "claude") resourceDomains.push("https://assets.claude.ai");

  // No frameDomains (no nested iframes) and no baseUriDomains (no <base>).
  return { connectDomains, resourceDomains };
}

/**
 * Static defaults, advertised in `resources/list` so hosts can review the
 * widget's security policy at connection time.
 */
export const widgetListingMeta: { ui: McpUiResourceMeta } = {
  ui: { csp: widgetCsp("unknown"), prefersBorder: true },
};

/**
 * Metadata returned with the HTML in `resources/read`. Hosts prefer this over
 * the listing-level metadata (Claude ignores the listing entirely when the
 * content item has `_meta.ui`), so it must be complete.
 */
export function widgetContentMeta(host: McpHost): { ui: McpUiResourceMeta } {
  const ui: McpUiResourceMeta = { csp: widgetCsp(host), prefersBorder: true };
  const domain =
    host === "claude" ? CLAUDE_DOMAIN : host === "chatgpt" ? CHATGPT_DOMAIN : undefined;
  if (domain) ui.domain = domain;
  return { ui };
}

// ---------------------------------------------------------------------------
// Dedicated sandbox domains (`_meta.ui.domain`), opt-in via env.
//
// Each host defines its own format, so one value can't serve both:
//   - Claude: `{sha256(connector URL)[0:32]}.claudemcpcontent.com`, validated
//     against the connector URL. Needed for a stable origin (own OAuth flow,
//     CORS allowlists, embedded sites).
//   - ChatGPT: an origin, unique per app. Required for app submission.
// ---------------------------------------------------------------------------

const CLAUDE_DOMAIN = resolveClaudeDomain(process.env.CLAUDE_WIDGET_DOMAIN);
const CHATGPT_DOMAIN = resolveChatgptDomain(process.env.CHATGPT_WIDGET_DOMAIN);

function resolveClaudeDomain(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "auto") {
    // Must be the exact URL configured in Claude (scheme, path, trailing slash).
    const serverUrl = process.env.MCP_SERVER_URL ?? `${baseURL}/mcp`;
    const hash = createHash("sha256").update(serverUrl).digest("hex").slice(0, 32);
    return `${hash}.claudemcpcontent.com`;
  }
  if (!/^[0-9a-f]{32}\.claudemcpcontent\.com$/.test(value)) {
    throw new Error(
      `CLAUDE_WIDGET_DOMAIN must be "auto" or "{32 hex chars}.claudemcpcontent.com" (got "${value}").`,
    );
  }
  return value;
}

function resolveChatgptDomain(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = URL.canParse(value) ? new URL(value) : undefined;
  if (url?.protocol !== "https:" || url.origin !== value.replace(/\/+$/, "")) {
    throw new Error(`CHATGPT_WIDGET_DOMAIN must be an https origin (got "${value}").`);
  }
  return url.origin;
}

// ---------------------------------------------------------------------------
// Host detection
// ---------------------------------------------------------------------------

export type McpHost = "claude" | "chatgpt" | "unknown";

/**
 * Which host is making the request, from the `clientInfo` that every MCP
 * request carries in its `_meta` envelope.
 *
 * `clientInfo` is self-reported and unauthenticated: use the result only for
 * host-specific presentation metadata (sandbox domain, font origin), never for
 * access control, and degrade gracefully when it's `"unknown"`.
 */
export function detectHost(ctx?: ServerContext): McpHost {
  const envelope = ctx?.mcpReq?.envelope as Record<string, unknown> | undefined;
  const clientInfo = envelope?.["io.modelcontextprotocol/clientInfo"] as
    | { name?: unknown }
    | undefined;
  const name = typeof clientInfo?.name === "string" ? clientInfo.name.toLowerCase() : "";

  if (name.includes("claude") || name.startsWith("anthropic")) return "claude";
  if (name.includes("openai") || name.includes("chatgpt")) return "chatgpt";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Widget HTML
// ---------------------------------------------------------------------------

const htmlCache = new Map<string, Promise<string>>();

/**
 * Fetch the server-rendered Next.js page that becomes the widget.
 *
 * The page is static, so in production the HTML is fetched once per server
 * instance. In development it is re-fetched on every read so edits show up.
 */
export function getWidgetHtml(path = "/"): Promise<string> {
  if (process.env.NODE_ENV !== "production") return fetchWidgetHtml(path);

  let cached = htmlCache.get(path);
  if (!cached) {
    cached = fetchWidgetHtml(path);
    htmlCache.set(path, cached);
    cached.catch(() => htmlCache.delete(path));
  }
  return cached;
}

async function fetchWidgetHtml(path: string): Promise<string> {
  const url = new URL(path, baseURL);
  const headers = new Headers({ accept: "text/html" });
  // Lets the self-fetch through Vercel Deployment Protection on previews when
  // "Protection Bypass for Automation" is enabled.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers.set("x-vercel-protection-bypass", bypass);

  const res = await fetch(url, {
    headers,
    cache: "no-store",
    // Don't follow redirects (e.g. to a login page) or forward the bypass secret.
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("text/html")) {
    throw new Error(
      `Failed to load widget HTML from ${url} (${res.status} ${res.statusText}, ` +
        `${contentType || "no content-type"}). Check BASE_URL and Vercel Deployment Protection.`,
    );
  }
  return res.text();
}
