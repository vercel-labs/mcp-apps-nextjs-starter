import type { McpUiToolMeta } from "@modelcontextprotocol/ext-apps";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { ToolAnnotations } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { greet, type Language, LANGUAGE_CODES } from "@/lib/greetings";
import { withOriginValidation } from "@/lib/mcp-cors";
import {
  detectHost,
  getWidgetHtml,
  WIDGET_URI,
  widgetContentMeta,
  widgetListingMeta,
} from "@/lib/widget";

const name = z.string().trim().min(1).max(100).describe("Name of the person to greet");
const language = z.enum(LANGUAGE_CODES).describe("Language of the greeting");
const greetingOutput = z.object({ name: z.string(), language, greeting: z.string() });

// Both tools only compute a string: read-only, no side effects, closed world.
const readOnly: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

/** MCP Apps tool metadata (`_meta.ui`): which UI renders the tool, who can call it. */
const ui = (meta: McpUiToolMeta) => ({ ui: meta });

/**
 * `content` is what the model (and hosts without MCP Apps support) see;
 * `structuredContent` is what the widget renders. Keep both meaningful.
 */
function greetingResult(args: { name: string; language?: Language }) {
  const result = greet(args.name, args.language);
  return {
    content: [{ type: "text" as const, text: result.greeting }],
    structuredContent: result,
  };
}

const handler = createMcpHandler(
  (server) => {
    // UI resource: the server-rendered Next.js page at `/`.
    registerAppResource(
      server,
      "Greeting card",
      WIDGET_URI,
      {
        title: "Greeting card",
        description: "Interactive greeting card rendered by the greet tool.",
        _meta: widgetListingMeta,
      },
      async (_uri, ctx) => ({
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: await getWidgetHtml("/"),
            _meta: widgetContentMeta(detectHost(ctx)),
          },
        ],
      }),
    );

    // Model-facing tool that renders the widget.
    server.registerTool(
      "greet",
      {
        title: "Greet someone",
        description:
          "Use this when the user wants to greet someone by name. Shows an " +
          "interactive greeting card where the user can switch languages.",
        inputSchema: z.object({
          name,
          language: language.optional().describe("Language of the greeting. Defaults to English."),
        }),
        outputSchema: greetingOutput,
        annotations: readOnly,
        _meta: ui({ resourceUri: WIDGET_URI }),
      },
      async (args) => greetingResult(args),
    );

    // App-only tool: hidden from the model, callable from the widget via
    // `app.callServerTool()` (see app/page.tsx).
    server.registerTool(
      "translate_greeting",
      {
        title: "Translate greeting",
        description: "Returns the greeting for a name in another language.",
        inputSchema: z.object({ name, language }),
        outputSchema: greetingOutput,
        annotations: readOnly,
        _meta: ui({ visibility: ["app"] }),
      },
      async (args) => greetingResult(args),
    );

    // Hosts without MCP Apps support ignore `_meta.ui` and use `content`, so
    // the same tools serve every client.
  },
  {
    serverInfo: { name: "mcp-apps-nextjs-starter", version: "1.0.0" },
  },
);

// Streamable HTTP (2026-07-28): every message is a POST to this endpoint.
// OPTIONS answers CORS preflights from allowed browser origins.
const handle = withOriginValidation(handler);

export { handle as POST, handle as OPTIONS };
