import type { NextConfig } from "next";
import { baseURL } from "./baseUrl";

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

  async headers() {
    return [
      {
        // Fonts (and any `crossorigin` script/style) are fetched in CORS mode
        // from the sandbox origin. Static build output is public and immutable.
        source: "/_next/static/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
