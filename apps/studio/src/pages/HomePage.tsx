import { useStudioRouter } from "studio";
import {
  STUDIO_PAGES,
  bucketLabel,
  type Bucket,
  type Page,
} from "../registry";
import { buildEngExtraPages } from "../content";

const PRIMITIVE_BUCKETS: readonly Bucket[] = [
  "foundations",
  "atoms",
  "compositions",
];

export function HomePage() {
  const { Link } = useStudioRouter();
  const primitives = STUDIO_PAGES.filter((p) =>
    PRIMITIVE_BUCKETS.includes(p.bucket),
  );
  const proposals = buildEngExtraPages();

  return (
    <main className="mx-auto max-w-4xl px-8 py-12">
      <header className="mb-14">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
          · hudson · studio
        </div>
        <h1 className="mt-3 font-sans text-[44px] font-medium leading-[1.05] tracking-tight text-studio-ink-strong">
          A working surface for hudsonkit.
        </h1>
        <p
          className="mt-5 max-w-[58ch] text-[15px] leading-[1.65] text-studio-ink"
          style={{ fontFamily: "var(--studio-font-serif)" }}
        >
          Foundations, atoms, and compositions rendered through the shared
          studio package — Hudson dogfooding hudsonkit. HUD-NNN proposals
          auto-discovered from{" "}
          <code className="font-mono text-[13px] text-studio-ink-strong">
            specs/
          </code>{" "}
          and the Apple shell docs, ordered by HUD number. Published Hudson
          docs live at{" "}
          <code className="font-mono text-[13px] text-studio-ink-strong">
            hudsonkit.com/docs
          </code>
          .
        </p>
      </header>

      {/* Primitives — compact 3-column grid grouped by bucket */}
      <section className="mb-16">
        <div className="mb-5 flex items-baseline gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
            · Primitives
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-studio-ink-faint">
            {primitives.length} exhibits
          </div>
          <div className="ml-2 h-px flex-1 bg-studio-rule" />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
          {PRIMITIVE_BUCKETS.map((bucket) => {
            const pages = primitives.filter((p) => p.bucket === bucket);
            if (pages.length === 0) return null;
            return (
              <div key={bucket}>
                <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-studio-ink-faint">
                  {bucketLabel(bucket)}
                </div>
                <ul className="space-y-2.5">
                  {pages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="group block"
                      >
                        <div className="text-[14.5px] font-medium tracking-tight text-studio-ink-strong group-hover:underline group-hover:decoration-studio-edge group-hover:underline-offset-4">
                          {page.label}
                        </div>
                        {page.blurb ? (
                          <p
                            className="mt-1 text-[12.5px] leading-[1.55] text-studio-ink-faint"
                            style={{ fontFamily: "var(--studio-font-serif)" }}
                          >
                            {page.blurb}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Proposals — editorial list, reverse-chrono. Numeric id leads, title
          carries the line, origin sits in a thin trailing meta column. */}
      <section className="mb-16">
        <div className="mb-5 flex items-baseline gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
            · Proposals
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-studio-ink-faint">
            {proposals.length} · by HUD-NNN
          </div>
          <div className="ml-2 h-px flex-1 bg-studio-rule" />
        </div>
        <ul className="divide-y divide-studio-rule border-y border-studio-rule">
          {proposals.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="group grid grid-cols-[80px_1fr_auto] items-baseline gap-4 py-3 transition-colors hover:bg-studio-chip-bg"
              >
                <div className="font-mono text-[11px] tracking-[0.06em] text-studio-ink-faint group-hover:text-studio-ink-strong">
                  {extractHudId(page)}
                </div>
                <div
                  className="text-[14.5px] leading-snug tracking-tight text-studio-ink-strong"
                  style={{ fontFamily: "var(--studio-font-serif)" }}
                >
                  {extractHudTitle(page)}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
                  {page.blurb}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// Labels are stored as "HUD-NNN · Title" — split for the two-column row.
function extractHudId(page: Page): string {
  const dot = page.label.indexOf(" · ");
  return dot === -1 ? page.label : page.label.slice(0, dot);
}
function extractHudTitle(page: Page): string {
  const dot = page.label.indexOf(" · ");
  return dot === -1 ? "" : page.label.slice(dot + 3);
}
