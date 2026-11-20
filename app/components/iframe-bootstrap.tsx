/**
 * Inline script that lets a Next.js page run inside an MCP Apps host.
 *
 * The host loads the widget HTML into a sandboxed iframe on its own origin
 * (often `about:srcdoc` or a document written by a sandbox proxy), so the
 * page's origin is not this server. `assetPrefix` (next.config.ts) makes
 * script/style URLs absolute; this script covers the rest, before React
 * hydrates:
 *
 * 1. fetch: Next.js fetches RSC payloads for client-side navigation with
 *    relative URLs. Point those at this server.
 * 2. history: the sandbox may reject pushState/replaceState for URLs it can't
 *    represent (SecurityError). Retry with a path-only URL and otherwise
 *    ignore, always preserving Next.js' router state. When the host wrote the
 *    HTML into a blank frame (document.write), the frame's URL can't be
 *    reloaded, so going "back" to it would break the widget: in that case
 *    pushState becomes replaceState and navigation adds no history entries.
 * 3. `next dev` only: the HMR WebSocket URL is derived from `location`, which
 *    is the host's sandbox. Point it at this server.
 *
 * No `<base>` tag: hosts apply `base-uri 'self'` by default, so it would be
 * blocked anyway.
 */
export function IframeBootstrap({ baseUrl }: { baseUrl: string }) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(${patchForIframe.toString()})(${JSON.stringify(baseUrl)}, ${isDev});`,
      }}
    />
  );
}

/**
 * Serialized with `.toString()` and run in the browser: keep it
 * self-contained and stick to syntax that needs no compiler helpers.
 */
function patchForIframe(baseUrl: string, isDev: boolean) {
  const appOrigin = new URL(baseUrl).origin;
  if (window.self === window.top || window.location.origin === appOrigin) return;

  // 1. Route same-origin fetches (RSC payloads, route handlers) to this server.
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const raw =
      typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin && url.origin !== appOrigin) {
      return originalFetch(input, init);
    }
    const target = appOrigin + url.pathname + url.search + url.hash;
    return typeof input === "string" || input instanceof URL
      ? originalFetch(target, init)
      : originalFetch(new Request(target, input), init);
  } as typeof window.fetch;

  // 2. Keep history updates from throwing inside the sandbox.
  const navigation = performance.getEntriesByType
    ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
    : undefined;
  const writtenIntoBlankFrame =
    !!navigation &&
    navigation.name.indexOf("about:") === 0 &&
    window.location.protocol !== "about:";

  const methods = ["pushState", "replaceState"] as const;
  methods.forEach(function (method) {
    const original =
      method === "pushState" && writtenIntoBlankFrame
        ? history.replaceState.bind(history)
        : history[method].bind(history);
    history[method] = function (state: unknown, unused: string, url?: string | URL | null) {
      try {
        return original(state, unused, url);
      } catch {
        try {
          const u = new URL(String(url == null ? "" : url), window.location.href);
          return original(state, unused, u.pathname + u.search + u.hash);
        } catch {
          // e.g. about:srcdoc documents can't change their URL at all.
        }
      }
    };
  });

  // 3. Dev only: send the HMR WebSocket to this server instead of the sandbox.
  if (isDev) {
    const NativeWebSocket = window.WebSocket;
    const app = new URL(appOrigin);
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const u = new URL(String(url), window.location.href);
        if (u.host === window.location.host) {
          u.protocol = app.protocol === "https:" ? "wss:" : "ws:";
          u.host = app.host;
        }
        super(u.href, protocols);
      }
    };
  }
}
