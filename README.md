# MCP Apps Next.js Starter

A [Next.js](https://nextjs.org) starter for [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview): interactive UIs that MCP hosts such as **Claude** and **ChatGPT** render alongside tool calls.

One Next.js app is both:

1. **The MCP server** (`app/mcp/route.ts`): tools and a `ui://` resource, served with [`mcp-handler`](https://github.com/vercel/mcp-handler) and the [MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps).
2. **The widget** (`app/page.tsx`): a regular Next.js page. The MCP server serves its server-rendered HTML as the `ui://` resource, and the host renders it in a sandboxed iframe.

## What's included

- **MCP server**: [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) 2.x through `mcp-handler` 2.x. It serves the current MCP protocol (2026-07-28: stateless, with per-request client info) over Streamable HTTP, and validates the `Origin` header as the transport spec requires.
- **Tools**:
  - `greet`: the model calls it, and it renders the widget. It declares `_meta.ui.resourceUri`, input and output schemas, and annotations.
  - `translate_greeting`: an app-only tool (`visibility: ["app"]`) that the widget calls with `app.callServerTool()`. The model never sees it.
- **UI resource**: `text/html;profile=mcp-app`, CSP (`connectDomains`/`resourceDomains`), `prefersBorder`, and an optional per-host `domain`. All metadata uses the spec's `_meta.ui` fields only, with no compatibility aliases or vendor keys.
- **Widget**: uses the `App` bridge from `@modelcontextprotocol/ext-apps`:
  - Tool input (including partial, streamed input), tool result, cancellation, and teardown.
  - The host's theme, CSS variables and fonts (`useHostStyles`), safe area insets, and auto-resize.
  - Inline and fullscreen display modes, `ui/open-link` for external links, and `ui/update-model-context`.
- **Next.js inside a sandbox**: absolute `assetPrefix`, CORS for assets and RSC payloads, and a small inline bootstrap script for client-side navigation, history and dev-mode HMR. Multi-page navigation is offered in fullscreen only, following the hosts' design guidelines.

## How it works

```
Host (Claude / ChatGPT)                       This Next.js app
───────────────────────                       ─────────────────────────────
tools/call greet ───────────────────────────▶ /mcp  → { content, structuredContent }
resources/read ui://…/widget-v1.html ───────▶ /mcp  → HTML of "/" + _meta.ui (CSP, …)
render HTML in a sandboxed iframe
  ├─ scripts, styles, RSC payloads ─────────▶ https://your-app/_next/…  (CORS)
  └─ postMessage (JSON-RPC, ui/*) ◀───────▶ App bridge in the widget
       ui/notifications/tool-result            → renders the greeting
       tools/call translate_greeting ───────▶ /mcp (proxied by the host)
```

## Getting started

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

The MCP endpoint is `http://localhost:3000/mcp`. Opening `http://localhost:3000` directly shows the widget in standalone mode.

### Test locally

**MCP Inspector** (protocol and tools):

```bash
npx @modelcontextprotocol/inspector@latest --cli http://localhost:3000/mcp --transport http --method tools/list
npx @modelcontextprotocol/inspector@latest --cli http://localhost:3000/mcp --transport http --method tools/call --tool-name greet --tool-arg name=Ada
```

**basic-host** (renders the widget the way a host does): the MCP Apps reference host.

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps && npm install
cd examples/basic-host
SERVERS='["http://localhost:3000/mcp"]' npm start
# open http://localhost:8080, pick "greet", call it with {"name":"Ada"}
```

See [Testing MCP Apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/testing-mcp-apps.md).

### Test in Claude and ChatGPT

Hosts reach your server from their own infrastructure, so it needs a public HTTPS URL. Use a tunnel (for example, `ngrok http 3000` or Cloudflare Tunnel) and set `BASE_URL` in `.env.local`:

```bash
BASE_URL=https://xxxx.ngrok-free.app
```

Restart `pnpm dev`, then add `https://xxxx.ngrok-free.app/mcp`:

- **Claude**: [Customize > Connectors](https://claude.ai/customize/connectors) → add a custom connector ([docs](https://claude.com/docs/connectors/building/testing)). Use a remote URL: Claude Desktop's local (stdio) config doesn't support app tools or `ui.domain`.
- **ChatGPT**: [Plugins](https://chatgpt.com/plugins) → **+** → **Add custom MCP server** ([docs](https://developers.openai.com/plugins/deploy/connect-chatgpt)).

Then ask: _"Greet Ada"_.

In `next dev`, the host's CSP blocks `eval`, which React uses only for development-time debugging. The widget still works, but Next.js shows a dismissible **1 Issue** toast. Production builds don't use `eval`.

> [!WARNING]
> A tunnel exposes your dev server publicly. Shut it down when you're done.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vercel-labs/mcp-apps-nextjs-starter)

`BASE_URL` is derived from Vercel's system environment variables. Connect hosts to `https://your-app.vercel.app/mcp`.

- **Deployment Protection**: preview deployments are protected by default, and hosts can't load a protected widget. Test against production, or disable [Deployment Protection](https://vercel.com/docs/deployment-protection) for previews.
- **Skew Protection (recommended)**: hosts cache widget HTML (ChatGPT for up to an hour). That HTML references hashed assets on your domain, which disappear on the next deploy. Enable [Skew Protection](https://vercel.com/docs/skew-protection) and add the hosts' sandbox origins under **Allowed Domains for Cross-Site Fetch**: `*.claudemcpcontent.com` and `*.oaiusercontent.com`. Next.js then pins asset requests to the deployment that rendered the HTML.
- **Breaking UI changes**: bump `WIDGET_URI` in `lib/widget.ts`, because hosts treat the URI as a cache key.

Self-hosting works too: set `BASE_URL` at build and run time. The build fails if it can't determine the public URL.

## Host-specific notes

The template uses only the [MCP Apps spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx): no `window.openai`, no `openai/*` metadata, and no deprecated keys. Both hosts render it through the standard bridge. These are the places where the hosts differ:

| | Claude | ChatGPT |
|---|---|---|
| Sandbox domain (`_meta.ui.domain`) | Optional; needed for a stable origin (own OAuth, CORS allowlists, embedded sites). Must be `{sha256(connector URL)[0:32]}.claudemcpcontent.com`. Set `CLAUDE_WIDGET_DOMAIN=auto`. | Required to submit an app with UI; an origin unique to your app. Set `CHATGPT_WIDGET_DOMAIN`. |
| Host fonts | Anthropic Sans from `https://assets.claude.ai` (added to the CSP for Claude requests) | System fonts |
| External links | Confirmation dialog unless the link's origin is on your directory listing's **Allowed link URIs** list | `ui/open-link` |
| Submission | [Connector submission](https://claude.com/docs/connectors/building/submission): every tool needs `title` + `readOnlyHint`/`destructiveHint` | [App submission](https://developers.openai.com/plugins/deploy/submission): `readOnlyHint`, `openWorldHint`, `destructiveHint` on every tool |
| Limits | ~150,000 characters per tool result; 240 s per tool call | Resource contents cached for up to 1 hour |

Because one `ui.domain` value can't satisfy both hosts, `lib/widget.ts` picks it per request from the `clientInfo` each MCP request carries. `clientInfo` is self-reported and its values aren't documented, so when the host is unknown the domain is simply omitted. Hosts then use their default sandbox origin.

### Known limitations

- **Hosts that render through `srcdoc` or `blob:` URLs aren't supported.** Next.js' App Router needs a hierarchical document URL. Claude, ChatGPT and the reference basic-host work.
- In hosts that write the HTML into a blank iframe (like basic-host), in-widget navigation replaces the history entry instead of pushing one, because the frame's URL can't be reloaded. Use in-app links to navigate back.

## Security

- **Widget CSP** (`lib/widget.ts`): hosts allow the widget to reach only the origins it declares.
  - `connectDomains` and `resourceDomains` contain just this app's origin. In `next dev`, `connectDomains` also gets the HMR WebSocket origin, and requests detected as Claude add Claude's font origin.
  - There are no `frameDomains` or `baseUriDomains`, no `<base>` tag, and no `unsafe-eval`. The SDK runs zod in jitless mode.
  - The CSP is advertised both in `resources/list`, for review at connection time, and in `resources/read`, which takes precedence.
- **`/mcp`** (`lib/mcp-cors.ts`) validates `Origin` as the MCP transport spec requires:
  - Unknown browser origins get `403`.
  - Allowed origins: this app, Claude, ChatGPT, localhost in development, and `MCP_ALLOWED_ORIGINS`.
  - CORS reflects only allowed origins and never allows credentials.
  - The widget doesn't call `/mcp` directly. It goes through the host (`app.callServerTool`).
- **Pages and assets** (`proxy.ts`, `next.config.ts`): `Access-Control-Allow-Origin: *` on `GET`/`HEAD` only, for public, uncredentialed content. Server Actions and other writes stay same-origin. If the widget calls your own route handlers with credentials, give those routes an explicit allowlist.
- **Links**: the widget never navigates itself. External `http(s)`/`mailto` links go through `ui/open-link`, and only when the host supports it.
- **Config**: `BASE_URL`, `CLAUDE_WIDGET_DOMAIN`, `CHATGPT_WIDGET_DOMAIN` and `MCP_ALLOWED_ORIGINS` are validated at startup, so malformed values fail the build instead of ending up in CSP or CORS headers.

## Customize

- **Tools and resources**: `app/mcp/route.ts`. Keep `content` meaningful for the model and for hosts without UI. Put what the widget needs in `structuredContent`. For real apps, split data-fetching tools from the tool that renders UI ([guide](https://developers.openai.com/plugins/build/chatgpt-ui#separate-data-processing-from-ui-rendering)).
- **Widget**: `app/page.tsx` (plus any other pages). Read state with `useMcpApp()` from `app/hooks/use-mcp-app.ts`.
- **CSP**: add every origin the widget fetches from or loads assets from to `widgetCsp()` in `lib/widget.ts`. Keep the list minimal: hosts review it, and `resourceDomains` also allows scripts.
- **Styling**: use the host-variable tokens in `app/globals.css` (`bg-background-secondary`, `text-text-secondary`, `border-border-primary`, …) so the widget follows each host's theme.
- **Auth**: to require sign-in, wrap the handler with `withMcpAuth` from `mcp-handler` ([guide](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md)). Both hosts support OAuth with Client ID Metadata Documents and Dynamic Client Registration ([Claude](https://claude.com/docs/connectors/building/authentication), [ChatGPT](https://developers.openai.com/plugins/build/auth)).

## Environment variables

All optional on Vercel. See `.env.example`.

| Variable | Purpose |
|---|---|
| `BASE_URL` | Public URL of the app (tunnel, self-hosting). |
| `MCP_SERVER_URL` | Public MCP URL if not `${BASE_URL}/mcp` (used for Claude's domain hash). |
| `MCP_ALLOWED_ORIGINS` | Extra browser origins allowed to call `/mcp` (comma-separated). |
| `CLAUDE_WIDGET_DOMAIN` | `auto` or an explicit `{hash}.claudemcpcontent.com`. |
| `CHATGPT_WIDGET_DOMAIN` | ChatGPT sandbox origin for your app. |

## Project structure

```
app/
  mcp/route.ts                     MCP server: tools and the ui:// resource
  page.tsx                         The widget (greet tool UI)
  counter/page.tsx, about/page.tsx Extra pages (client-side navigation, fullscreen)
  hooks/use-mcp-app.ts             App bridge: connection + host/tool state
  components/mcp-app-shell.tsx     Host styles, safe areas, external links
  components/iframe-bootstrap.tsx  Inline script for running inside the sandbox
  layout.tsx, globals.css          Root layout, host-variable theme tokens
lib/
  widget.ts                        Widget URI, CSP/domain metadata, host detection, HTML loading
  mcp-cors.ts                      Origin validation + CORS for /mcp
  greetings.ts                     Example domain logic
baseUrl.ts                         Public URL resolution (env / Vercel / localhost)
proxy.ts                           CORS for pages and RSC payloads
next.config.ts                     assetPrefix, dev origins, static asset CORS
```

## Learn more

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview) · [specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) · [SDK docs](https://apps.extensions.modelcontextprotocol.io/api/)
- [Build MCP Apps for Claude](https://claude.com/docs/connectors/building/mcp-apps/getting-started) · [design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines)
- [Add UI to your MCP server (ChatGPT)](https://developers.openai.com/plugins/build/chatgpt-ui) · [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines)
- [mcp-handler](https://github.com/vercel/mcp-handler)
