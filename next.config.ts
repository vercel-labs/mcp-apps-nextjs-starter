import type { NextConfig } from "next";
import { baseURL } from "./baseUrl";

/**
 * Everything except `/mcp`, which validates `Origin` itself (lib/mcp-cors.ts),
 * and `/.well-known`, where routes such as mcp-handler's OAuth metadata set
 * their own CORS headers.
 */
const WIDGET_ROUTES = "/:path((?!mcp(?:$|/)|\\.well-known).*)";

const nextConfig: NextConfig = {
  // The widget runs on the host's sandbox origin, so script/style/font URLs
  // must be absolute and point back at this server.
  assetPrefix: baseURL,
  devIndicators: false,

  // `next dev` blocks cross-origin requests for dev assets by default. Allow
  // the MCP Apps sandbox origins of Claude and ChatGPT, plus your tunnel.
  // (Development only; these origins vary per conversation, hence wildcards.)
  allowedDevOrigins: [
    new URL(baseURL).hostname,
    "localhost",
    "127.0.0.1",
    "*.claudemcpcontent.com",
    "**.oaiusercontent.com",
  ],

  // CORS for the widget. Inside a host, the widget runs on a sandbox origin
  // (`*.claudemcpcontent.com`, `*.oaiusercontent.com`, …), so it loads assets
  // and client-side navigation payloads from this server cross-origin.
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Next.js answers OPTIONS on pages with 405, which fails the CORS
          // preflight that navigations trigger. Preflights (and only
          // preflights) carry Access-Control-Request-Method: answer them
          // with a 204 from app/cors-preflight/route.ts.
          source: WIDGET_ROUTES,
          has: [{ type: "header", key: "access-control-request-method" }],
          destination: "/cors-preflight",
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: WIDGET_ROUTES,
        // Server Actions stay same-origin: their responses get no CORS
        // headers, and preflights only allow GET and HEAD.
        missing: [{ type: "header", key: "next-action" }],
        headers: [
          // Public, uncredentialed content only: a wildcard origin never
          // exposes cookie-authenticated responses.
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD" },
          // Next.js router headers (rsc, next-router-state-tree, …, and
          // x-deployment-id on Vercel) change between versions.
          { key: "Access-Control-Allow-Headers", value: "*" },
          // The router reads response headers such as x-nextjs-deployment-id.
          // If it can't, it falls back to a full-page navigation, which the
          // host's sandbox blocks.
          { key: "Access-Control-Expose-Headers", value: "*" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
