"use client";

import { useState } from "react";
import Link from "next/link";

export default function CounterPage() {
  const [count, setCount] = useState(0);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 py-8">
      <BackLink />

      <h1 className="text-2xl font-semibold text-text-primary">Counter</h1>
      <p className="text-sm text-text-secondary">
        Client-side state and a client-side navigation, to check that hydration and routing work
        inside the host&apos;s sandboxed iframe.
      </p>

      <div className="flex items-center gap-4">
        <CounterButton label="Decrement" onClick={() => setCount((c) => c - 1)}>
          −
        </CounterButton>
        <span
          aria-live="polite"
          className="min-w-[3ch] text-center text-2xl font-semibold text-text-primary tabular-nums"
        >
          {count}
        </span>
        <CounterButton label="Increment" onClick={() => setCount((c) => c + 1)}>
          +
        </CounterButton>
      </div>
    </main>
  );
}

function CounterButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-md border border-border-primary text-lg font-medium text-text-primary transition-colors hover:bg-background-secondary focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      prefetch={false}
      className="text-sm text-text-secondary hover:text-text-primary"
    >
      &larr; Back
    </Link>
  );
}
