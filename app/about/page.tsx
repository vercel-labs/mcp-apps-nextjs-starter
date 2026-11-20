import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 py-8">
      <Link href="/" prefetch={false} className="text-sm text-text-secondary hover:text-text-primary">
        &larr; Back
      </Link>

      <h1 className="text-2xl font-semibold text-text-primary">About</h1>

      <div className="flex flex-col gap-3 text-sm text-text-secondary">
        <p>
          This starter renders a Next.js app as an{" "}
          <a
            href="https://modelcontextprotocol.io/extensions/apps/overview"
            className="text-text-primary underline underline-offset-2"
          >
            MCP App
          </a>
          . The MCP server at <Code>/mcp</Code> serves this app&apos;s server-rendered HTML as a{" "}
          <Code>ui://</Code> resource, and hosts such as Claude and ChatGPT render it in a sandboxed
          iframe next to the tool call.
        </p>
        <p>
          The widget talks to the host through the <Code>App</Code> class from{" "}
          <Code>@modelcontextprotocol/ext-apps</Code>: it receives tool input and results, calls
          server tools, follows the host&apos;s theme, and asks the host to open links and change
          display mode.
        </p>
        <p>
          This page is a server component reached through client-side navigation, which only
          happens in full screen.
        </p>
      </div>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-text-primary">{children}</code>;
}
