/**
 * Public origin of the app (scheme + host [+ port], no trailing slash).
 *
 * The widget HTML is rendered inside a sandboxed iframe on the host's origin
 * (e.g. `*.claudemcpcontent.com` or `*.oaiusercontent.com`), so every asset,
 * RSC payload and API call has to point back at this server explicitly. The
 * value is also declared in the widget's CSP, so it must be a clean origin.
 *
 * Resolution order:
 *   1. `BASE_URL` — set this when using a tunnel (ngrok, cloudflared, …) or
 *      when self-hosting, e.g. `BASE_URL=https://xxxx.ngrok-free.app`.
 *   2. Vercel system environment variables (production / preview).
 *   3. `http://localhost:$PORT` in development.
 */
function resolveBaseUrl(): string {
  if (process.env.BASE_URL) return toOrigin(process.env.BASE_URL, "BASE_URL");

  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (vercelHost) return toOrigin(`https://${vercelHost}`, "VERCEL_URL");

  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }

  throw new Error(
    "Unable to determine the public base URL. Set BASE_URL (for example " +
      "BASE_URL=https://my-app.example.com) when building or running outside Vercel.",
  );
}

function toOrigin(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL, got "${value}".`);
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.pathname.replace(/\/+$/, "") ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${name} must be an http(s) origin without a path, e.g. https://my-app.example.com (got "${value}").`,
    );
  }
  return url.origin;
}

export const baseURL = resolveBaseUrl();
