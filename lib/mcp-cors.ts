import {
  localhostAllowedOrigins,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { baseURL } from "@/baseUrl";

/**
 * Origin validation + CORS for the MCP endpoint.
 *
 * The Streamable HTTP transport requires servers to validate the `Origin`
 * header and answer unknown browser origins with 403 (DNS rebinding / CSRF
 * protection). Requests without `Origin` (server-side clients) pass.
 *
 * Allowed browser origins:
 *   - this app's own origin
 *   - Claude and ChatGPT, whose backends sometimes send their web origin
 *   - localhost in development (MCP Inspector, ext-apps basic-host)
 *   - MCP_ALLOWED_ORIGINS: comma-separated hostnames or origins
 *
 * The widget itself never calls /mcp directly: it reaches the server through
 * the host (`app.callServerTool`), so sandbox origins are not allowed here.
 */
const allowedOriginHostnames = [
  new URL(baseURL).hostname,
  "claude.ai",
  "claude.com",
  "chatgpt.com",
  ...parseAllowedOrigins(process.env.MCP_ALLOWED_ORIGINS),
  ...(process.env.NODE_ENV === "production" ? [] : localhostAllowedOrigins()),
];

function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      const hostname = !entry.includes("://")
        ? entry
        : URL.canParse(entry)
          ? new URL(entry).hostname
          : "";
      if (!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+$|^\[[0-9a-f:.]+\]$/.test(hostname)) {
        throw new Error(`Invalid MCP_ALLOWED_ORIGINS entry: "${entry}"`);
      }
      return hostname;
    });
}

type Handler = (request: Request) => Promise<Response>;

/** Wrap an MCP request handler with Origin validation and CORS. */
export function withOriginValidation(handler: Handler): Handler {
  return async (request) => {
    const rejected = originValidationResponse(request, allowedOriginHostnames);
    if (rejected) return rejected;

    const response =
      request.method === "OPTIONS"
        ? new Response(null, { status: 204 })
        : await handler(request);
    return withCors(request, response);
  };
}

function withCors(request: Request, response: Response): Response {
  // Only browsers send `Origin`; reaching this point means it's allowed.
  const origin = request.headers.get("origin");
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.append("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    // MCP mirrors request metadata into headers (MCP-Protocol-Version,
    // Mcp-Method, Mcp-Name, Mcp-Param-*); echo the preflight for this origin.
    request.headers.get("access-control-request-headers") ??
      "content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name",
  );
  // OAuth challenges (401/403) carry WWW-Authenticate.
  headers.set("Access-Control-Expose-Headers", "www-authenticate");
  headers.set("Access-Control-Max-Age", "600");
  // No Access-Control-Allow-Credentials: MCP auth uses bearer tokens, not cookies.

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
