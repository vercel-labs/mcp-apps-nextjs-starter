<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## This project

An MCP Apps starter: one Next.js app is both the MCP server (`app/mcp/route.ts`) and the widget UI (`app/page.tsx`) that hosts such as Claude and ChatGPT render in a sandboxed iframe.

- MCP Apps spec and SDK: https://github.com/modelcontextprotocol/ext-apps (`@modelcontextprotocol/ext-apps` 2.x, built on the MCP TypeScript SDK 2.x split packages `@modelcontextprotocol/server` / `client`). Don't add `@modelcontextprotocol/sdk` (1.x).
- MCP Apps skills for coding agents: https://github.com/modelcontextprotocol/ext-apps/tree/main/plugins/mcp-apps
- Tools use `server.registerTool` with spec `_meta.ui` metadata (`resourceUri`, `visibility`); the UI resource uses `registerAppResource`. Schemas are `z.object(...)` (zod 4). Target the current MCP (2026-07-28) and MCP Apps specs only; no compatibility aliases or `openai/*` metadata.
- The widget runs on the host's origin: keep URLs absolute (`baseURL`), declare every origin it loads from or connects to in the resource CSP (`lib/widget.ts`), and talk to the host only through the `App` bridge (`app/hooks/use-mcp-app.ts`): `app.openLink`, `app.callServerTool`, `app.updateModelContext`, `app.requestDisplayMode`.
- Style with the host's CSS variables (Tailwind tokens in `app/globals.css`), not hard-coded colors.
- Verify with `pnpm lint && pnpm typecheck && pnpm build`, then the MCP Inspector and the ext-apps `basic-host` (see README).
