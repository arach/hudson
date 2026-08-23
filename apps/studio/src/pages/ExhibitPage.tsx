import { registry } from "../registry";
import { exhibits } from "../exhibits";
import { NotFoundPage } from "./NotFoundPage";

// Exhibits that take over the full content slot (no max-width, no header
// chrome). The exhibit is responsible for its own layout — including any
// breadcrumb / source affordances if it wants them.
const FULL_BLEED_EXHIBITS = new Set<string>([
  "canvas-terminals",
  "canvas-craft",
  "candidate-orientation",
]);

export function ExhibitPage({ slug }: { slug: string }) {
  const href = `/exhibits/${slug}`;
  // Registry is keyed by canonical href; nested URLs still resolve by slug.
  const page =
    registry.pageForPath(href) ??
    registry.pages.find((p) => p.href === href || p.href.endsWith(`/${slug}`));
  const Exhibit = exhibits[slug];

  if (!Exhibit) return <NotFoundPage path={href} />;
  // Allow a live exhibit even if registry metadata is missing (dev / partial wire).
  if (!page) {
    return (
      <div className="absolute inset-0">
        <Exhibit />
      </div>
    );
  }

  if (FULL_BLEED_EXHIBITS.has(slug)) {
    return (
      <div className="absolute inset-0">
        <Exhibit />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-7 py-10">
      <header className="mb-8 border-b border-studio-edge pb-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
          · {page.bucket}
        </div>
        <h1 className="mt-2 text-[24px] font-medium tracking-tight text-studio-ink-strong">
          {page.label}
        </h1>
        {page.blurb ? (
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-studio-ink-faint">
            {page.blurb}
          </p>
        ) : null}
        {page.source?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {page.source.map((src) => (
              <code
                key={src}
                className="rounded bg-studio-chip-bg px-2 py-0.5 font-mono text-[10px] text-studio-ink-faint"
              >
                {src}
              </code>
            ))}
          </div>
        ) : null}
      </header>
      <Exhibit />
    </main>
  );
}
