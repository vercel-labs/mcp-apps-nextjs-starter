"use client";

import { useEffect, type ReactNode } from "react";
import { useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { useMcpApp } from "../hooks/use-mcp-app";

const SAFE_LINK_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/**
 * Wraps every page and adapts it to the host:
 * - applies the host's theme, CSS variables and fonts (`useHostStyles`)
 * - pads content by the host's safe area insets
 * - routes external links through the host (`ui/open-link`), since the
 *   sandboxed iframe can't open them itself
 */
export function McpAppShell({
  appOrigin,
  children,
}: {
  appOrigin: string;
  children: ReactNode;
}) {
  const { app, hostContext } = useMcpApp();
  useHostStyles(app, hostContext);

  useEffect(() => {
    if (!app) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const url = new URL(anchor.href, window.location.href);
      const internal =
        url.origin === window.location.origin || url.origin === appOrigin;
      if (internal) return; // next/link handles in-app navigation

      // Never let the sandboxed iframe navigate away from the widget.
      event.preventDefault();
      // Only hand the host URLs that are safe to open (add your app's own
      // deep-link scheme here if you have one).
      if (!SAFE_LINK_PROTOCOLS.has(url.protocol)) {
        console.warn("[mcp-app] refusing to open", url.href);
        return;
      }
      if (!app.getHostCapabilities()?.openLinks) {
        console.warn("[mcp-app] host doesn't support opening links", url.href);
        return;
      }
      app
        .openLink({ url: url.href })
        .then(({ isError }) => {
          if (isError) console.warn("[mcp-app] host declined to open", url.href);
        })
        .catch((error) => console.warn("[mcp-app] openLink failed", error));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [app, appOrigin]);

  const insets = hostContext?.safeAreaInsets;
  return (
    <div
      style={{
        paddingTop: insets?.top,
        paddingRight: insets?.right,
        paddingBottom: insets?.bottom,
        paddingLeft: insets?.left,
      }}
    >
      {children}
    </div>
  );
}
