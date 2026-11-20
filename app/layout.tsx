import type { Metadata, Viewport } from "next";
import "./globals.css";
import { baseURL } from "@/baseUrl";
import { IframeBootstrap } from "./components/iframe-bootstrap";
import { McpAppShell } from "./components/mcp-app-shell";

export const metadata: Metadata = {
  title: "MCP Apps Next.js Starter",
  description: "Next.js starter for MCP Apps that render in Claude, ChatGPT and other hosts.",
};

export const viewport: Viewport = {
  // Covers first paint before the host theme is applied, avoiding an opaque
  // iframe backdrop flash.
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Hosts may set attributes on <html> (e.g. `lang`, `data-theme`, `style`).
    <html lang="en" suppressHydrationWarning>
      <head>
        <IframeBootstrap baseUrl={baseURL} />
      </head>
      <body className="font-sans antialiased">
        <McpAppShell appOrigin={new URL(baseURL).origin}>{children}</McpAppShell>
      </body>
    </html>
  );
}
