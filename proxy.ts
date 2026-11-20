import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS for the widget's pages.
 *
 * Inside an MCP Apps host the widget runs on a sandbox origin
 * (`*.claudemcpcontent.com`, `*.oaiusercontent.com`, …) that differs per host
 * and per connector, so client-side navigations fetch React Server Component
 * payloads from this server cross-origin.
 *
 * Scope:
 * - Read-only methods only (GET/HEAD). Server Actions and other writes stay
 *   same-origin.
 * - No credentials: a wildcard origin never exposes cookie-authenticated
 *   responses, and `Allow-Headers: *` doesn't cover `Authorization`.
 *   Route handlers that serve private data to the widget need their own,
 *   explicit CORS policy.
 * - `/mcp` validates `Origin` itself (lib/mcp-cors.ts); static assets get
 *   their header from next.config.ts.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD",
  // Next.js router headers (rsc, next-router-state-tree, next-url, …, and
  // x-deployment-id with Skew Protection) change between versions.
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const response = NextResponse.next();
  if (request.method === "GET" || request.method === "HEAD") {
    response.headers.set("Access-Control-Allow-Origin", "*");
    // The router reads response headers such as x-nextjs-deployment-id (set on
    // Vercel); if it can't, it falls back to a full-page navigation, which
    // breaks the widget inside the host's iframe.
    response.headers.set("Access-Control-Expose-Headers", "*");
  }
  return response;
}

export const config = {
  // `.well-known` routes (e.g. OAuth metadata from mcp-handler) set their own CORS.
  matcher: [
    "/((?!mcp(?:$|/)|_next/static|_next/image|\\.well-known).*)",
  ],
};
