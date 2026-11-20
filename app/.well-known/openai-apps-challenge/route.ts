/**
 * ChatGPT app submission domain verification.
 *
 * The OpenAI developer portal asks you to serve a token at
 * `/.well-known/openai-apps-challenge` on your MCP server's host.
 * Set OPENAI_APPS_CHALLENGE_TOKEN to that token; otherwise this returns 404.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN;
  if (!token) return new Response("Not found", { status: 404 });

  return new Response(token, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
