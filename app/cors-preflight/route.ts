/**
 * Answers CORS preflights for the widget's pages. next.config.ts rewrites
 * every preflight here (Next.js would answer OPTIONS on a page with 405) and
 * adds the CORS headers to this response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
