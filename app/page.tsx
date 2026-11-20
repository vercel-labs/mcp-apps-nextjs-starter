"use client";

import { useState } from "react";
import Link from "next/link";
import { requestDisplayMode, useMcpApp } from "./hooks/use-mcp-app";
import { type Greeting, isGreeting, type Language, LANGUAGE_CODES, LANGUAGES } from "@/lib/greetings";

/**
 * The widget rendered for the `greet` tool (see app/mcp/route.ts).
 *
 * Inline, it's a compact card: one piece of data, visible controls, at most
 * two actions. Multi-page navigation is only offered in fullscreen, following
 * the Claude and ChatGPT design guidelines.
 */
export default function GreetingWidget() {
  const {
    app,
    embedded,
    isConnected,
    error,
    hostContext,
    toolInput,
    toolInputPartial,
    toolResult,
    toolCancelled,
  } = useMcpApp();

  const [translated, setTranslated] = useState<Greeting | null>(null);
  const [pending, setPending] = useState<Language | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fromTool = isGreeting(toolResult?.structuredContent)
    ? toolResult.structuredContent
    : null;
  const greeting = translated ?? fromTool;
  const pendingName = stringArg(toolInput?.name) ?? stringArg(toolInputPartial?.name);
  // A failed tool call (e.g. invalid arguments) arrives as an `isError` result.
  const toolError = toolResult?.isError
    ? (firstText(toolResult.content) ?? "The tool call failed.")
    : undefined;
  const errorMessage = actionError ?? toolError;

  // Check host capabilities before using optional features.
  const hostCapabilities = app?.getHostCapabilities();
  const canCallServerTools = !!hostCapabilities?.serverTools;
  const canOpenLinks = !embedded || !!hostCapabilities?.openLinks;
  const isFullscreen = hostContext?.displayMode === "fullscreen";
  const canFullscreen = hostContext?.availableDisplayModes?.includes("fullscreen") ?? false;

  async function switchLanguage(language: Language) {
    if (!app || !canCallServerTools || !greeting || language === greeting.language) return;
    setPending(language);
    setActionError(null);
    try {
      // App → host → server. `translate_greeting` is app-only (hidden from the model).
      const result = await app.callServerTool({
        name: "translate_greeting",
        arguments: { name: greeting.name, language },
      });
      if (result.isError || !isGreeting(result.structuredContent)) {
        throw new Error("The server couldn't translate the greeting.");
      }
      const next = result.structuredContent;
      setTranslated(next);

      // Tell the model what the user did, so the next turn has context.
      if (hostCapabilities?.updateModelContext) {
        await app.updateModelContext({
          content: [
            {
              type: "text",
              text: `The user switched the greeting card to ${LANGUAGES[language].label}: "${next.greeting}"`,
            },
          ],
        });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  return (
    <main
      className={`flex w-full flex-col gap-4 p-4 ${isFullscreen || !embedded ? "mx-auto max-w-xl py-8" : ""}`}
    >
      <section className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
          Greeting
        </p>
        <h1 className="text-2xl font-semibold text-text-primary" aria-live="polite">
          {greeting?.greeting ??
            placeholder({ embedded, isConnected, error, toolCancelled, toolError, pendingName })}
        </h1>
      </section>

      {greeting && canCallServerTools && (
        <div role="group" aria-label="Language" className="flex flex-wrap gap-2">
          {LANGUAGE_CODES.map((code) => {
            const selected = code === greeting.language;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                disabled={pending !== null}
                onClick={() => switchLanguage(code)}
                className={`min-h-9 rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:outline-none disabled:opacity-60 ${
                  selected
                    ? "border-transparent bg-background-inverse text-text-inverse"
                    : "border-border-primary text-text-primary hover:bg-background-secondary"
                }`}
              >
                {pending === code ? "…" : LANGUAGES[code].label}
              </button>
            );
          })}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-text-danger">
          {errorMessage}
        </p>
      )}

      {(isFullscreen || !embedded) && (
        <nav className="flex flex-col gap-2" aria-label="Pages">
          <p className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
            Pages
          </p>
          <PageLink href="/counter">Counter demo</PageLink>
          <PageLink href="/about">About this starter</PageLink>
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {canFullscreen && (
          <button
            type="button"
            onClick={() => requestDisplayMode(isFullscreen ? "inline" : "fullscreen")}
            className="min-h-9 rounded-md bg-background-inverse px-3 text-sm font-medium text-text-inverse focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:outline-none"
          >
            {isFullscreen ? "Exit full screen" : "Open full screen"}
          </button>
        )}
        {/* External links are opened by the host via ui/open-link (see McpAppShell). */}
        {canOpenLinks && (
          <a
            href="https://modelcontextprotocol.io/extensions/apps/overview"
            className="min-h-9 content-center rounded-md px-3 text-sm text-text-secondary underline underline-offset-2 hover:text-text-primary"
          >
            About MCP Apps
          </a>
        )}
      </div>
    </main>
  );
}

function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-md border border-border-primary px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
    >
      {children} &rarr;
    </Link>
  );
}

function placeholder(s: {
  embedded: boolean;
  isConnected: boolean;
  error: Error | null;
  toolCancelled: boolean;
  toolError: string | undefined;
  pendingName: string | undefined;
}): string {
  if (!s.embedded) return "Open this page from an MCP Apps host to see a greeting.";
  if (s.error) return `Couldn't connect to the host: ${s.error.message}`;
  if (s.toolCancelled) return "The greeting was cancelled.";
  if (s.toolError) return "Couldn't create a greeting.";
  if (s.pendingName) return `Greeting ${s.pendingName}…`;
  if (!s.isConnected) return "Connecting…";
  return "Waiting for a greeting…";
}

function stringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstText(content: ReadonlyArray<{ type: string }> | undefined): string | undefined {
  const block = content?.find((c): c is { type: "text"; text: string } => c.type === "text");
  return block?.text;
}
