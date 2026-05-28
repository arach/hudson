import { useStudioRouter } from "studio";

export function NotFoundPage({ path }: { path: string }) {
  const { Link } = useStudioRouter();
  return (
    <main className="mx-auto max-w-3xl px-7 py-16">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
        · 404
      </div>
      <h1 className="mt-2 text-[24px] font-medium tracking-tight text-studio-ink-strong">
        Page not found
      </h1>
      <p className="mt-3 text-[13px] text-studio-ink-faint">
        No route matches{" "}
        <code className="rounded bg-studio-chip-bg px-1.5 py-0.5 font-mono text-[11px] text-studio-ink">
          {path}
        </code>
        .
      </p>
      <p className="mt-6 text-[13px]">
        <Link
          href="/"
          className="text-studio-ink-strong underline decoration-studio-edge underline-offset-4 hover:decoration-studio-ink"
        >
          Back to overview
        </Link>
      </p>
    </main>
  );
}
