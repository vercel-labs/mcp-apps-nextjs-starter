"use client";

import { useSyncExternalStore } from "react";
import {
  App,
  type McpUiDisplayMode,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/client";

/**
 * MCP Apps bridge for the widget.
 *
 * Each widget instance is its own iframe (its own JS realm), so a module-level
 * `App` is scoped to exactly one instance. It's created once when this module
 * first loads, survives client-side navigations between pages, and sends
 * exactly one `ui/initialize` even when React Strict Mode double-mounts
 * components in development. (`useApp()` from
 * `@modelcontextprotocol/ext-apps/react` is the alternative for single-page
 * views.)
 *
 * State is kept in memory only. Don't use sessionStorage/localStorage keyed by
 * a fixed name: hosts serve every widget instance from a connector on the same
 * origin, so instances would read each other's data.
 */

export interface McpAppState {
  /** Running inside an iframe, i.e. (probably) inside an MCP Apps host. */
  embedded: boolean;
  /** Connected `App`, or null before the handshake completes. */
  app: App | null;
  isConnected: boolean;
  error: Error | null;
  /** Theme, styles, display mode, safe area insets, locale, … */
  hostContext: McpUiHostContext | undefined;
  /** Tool arguments while the model is still streaming them. */
  toolInputPartial: Record<string, unknown> | undefined;
  /** Complete tool arguments. */
  toolInput: Record<string, unknown> | undefined;
  /** Tool result (`content` for the model, `structuredContent` for the UI). */
  toolResult: CallToolResult | undefined;
  toolCancelled: boolean;
}

const INITIAL_STATE: McpAppState = {
  embedded: false,
  app: null,
  isConnected: false,
  error: null,
  hostContext: undefined,
  toolInputPartial: undefined,
  toolInput: undefined,
  toolResult: undefined,
  toolCancelled: false,
};

let state = INITIAL_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<McpAppState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function connect() {
  const app = new App(
    { name: "mcp-apps-nextjs-starter", version: "1.0.0" },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: true },
  );

  // Register every handler BEFORE connect() so no notification is missed.
  app.ontoolinputpartial = ({ arguments: args }) => setState({ toolInputPartial: args });
  app.ontoolinput = ({ arguments: args }) =>
    setState({ toolInput: args, toolInputPartial: undefined });
  app.ontoolresult = (result) => setState({ toolResult: result });
  app.ontoolcancelled = () => setState({ toolCancelled: true });
  app.onhostcontextchanged = (changed) =>
    setState({ hostContext: { ...state.hostContext, ...changed } });
  app.onteardown = async () => {
    // Persist anything the user would lose here (e.g. via callServerTool).
    return {};
  };
  app.onerror = (error) => console.error("[mcp-app]", error);

  try {
    await app.connect();
    setState({ app, isConnected: true, hostContext: app.getHostContext() });
  } catch (error) {
    setState({ error: error instanceof Error ? error : new Error(String(error)) });
  }
}

if (typeof window !== "undefined" && window.parent !== window) {
  setState({ embedded: true });
  void connect();
}

/**
 * Ask the host to change display mode. Check `hostContext.availableDisplayModes`
 * first; resolves to the mode actually granted (hosts may decline).
 */
export async function requestDisplayMode(mode: McpUiDisplayMode) {
  const { app } = state;
  if (!app) return undefined;
  try {
    const result = await app.requestDisplayMode({ mode });
    setState({ hostContext: { ...state.hostContext, displayMode: result.mode } });
    return result.mode;
  } catch (error) {
    console.warn("[mcp-app] display mode request failed", error);
    return undefined;
  }
}

/** React hook for the MCP Apps bridge state. */
export function useMcpApp(): McpAppState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL_STATE,
  );
}
