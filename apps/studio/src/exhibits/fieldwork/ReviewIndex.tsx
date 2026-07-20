/**
 * Review · Index — work-tape archive sketch.
 * Moments stay source-linked and mixed; this is not a candidate ranking view.
 */

import { SurfaceShell, regionProps } from "./SurfaceShell";

const CSS = `
.ri-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
}
.ri-case {
  flex: none;
  text-align: right;
  line-height: 1.7;
}
.ri-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 32px;
  padding: 12px 0;
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  overflow-x: auto;
}
.ri-filter {
  appearance: none;
  flex: none;
  border: 1px solid var(--hairline);
  border-radius: 999px;
  background: transparent;
  color: var(--soft);
  padding: 6px 10px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ri-filter[data-active="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--raised);
}
.ri-index {
  margin-top: 24px;
  overflow: hidden;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
}
.ri-columns,
.ri-row {
  display: grid;
  grid-template-columns: 90px 150px minmax(240px, 1fr) 210px;
  align-items: center;
  gap: 18px;
}
.ri-columns {
  padding: 11px 18px;
  background: var(--sunken);
  color: var(--faint);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ri-row {
  position: relative;
  width: 100%;
  padding: 18px;
  border: 0;
  border-top: 1px solid var(--hairline);
  background: transparent;
  color: inherit;
  text-decoration: none;
  text-align: left;
  transition: background 120ms ease;
}
.ri-row:hover { background: color-mix(in srgb, var(--capture) 7%, transparent); }
.ri-time {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
}
.ri-kind {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 7px;
  color: var(--soft);
  font-size: 12px;
  font-weight: 600;
}
.ri-kind::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--capture);
}
.ri-kind[data-kind="Verification"]::before { background: var(--proof-pass); }
.ri-kind[data-kind="Handoff risk"]::before { background: var(--voice); }
.ri-observation {
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.35;
}
.ri-source {
  min-width: 0;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.45;
}
.ri-source-path {
  display: block;
  overflow: hidden;
  color: var(--capture);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ri-mixed {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: center;
  padding: 16px 18px;
  border-left: 3px solid var(--pause);
  background: color-mix(in srgb, var(--pause) 7%, var(--raised));
}
.ri-mixed strong { display: block; font-size: 13px; margin-bottom: 4px; }
.ri-mixed span { color: var(--soft); font-size: 13px; line-height: 1.5; }

@media (max-width: 820px) {
  .ri-header { display: block; }
  .ri-case { margin-top: 20px; text-align: left; }
  .ri-columns { display: none; }
  .ri-row { grid-template-columns: 76px 1fr; gap: 8px 14px; }
  .ri-kind { grid-column: 2; grid-row: 1; }
  .ri-observation, .ri-source { grid-column: 2; }
  .ri-mixed { grid-template-columns: 1fr; }
}
`;

const moments = [
  {
    id: "evt-0184",
    time: "00:14:08",
    kind: "Framing",
    observation: "Named the customer-visible failure before opening the code.",
    source: "terminal/session.log:184",
    trace: "command + voice",
  },
  {
    id: "evt-0261",
    time: "00:27:41",
    kind: "Verification",
    observation: "Reproduced the cache miss, then added a focused regression check.",
    source: "src/cache.test.ts:+42",
    trace: "diff + test run",
  },
  {
    id: "evt-0337",
    time: "00:39:16",
    kind: "Verification",
    observation: "First check passed, but did not exercise the stale-entry path.",
    source: "terminal/session.log:337",
    trace: "command output",
  },
  {
    id: "evt-0489",
    time: "00:58:03",
    kind: "Handoff risk",
    observation: "Documented the fix; rollback conditions remained implicit.",
    source: "HANDOFF.md:18–31",
    trace: "artifact",
  },
] as const;

export function ReviewIndex() {
  return (
    <SurfaceShell wide>
      <style>{CSS}</style>

      <header className="ri-header" {...regionProps("header", "Review header", "header")}>
        <div>
          <div className="fw-eyebrow">Review · Work tape</div>
          <h1 className="fw-title">Evidence, in the order it happened.</h1>
          <p className="fw-lede">
            Open a moment to inspect its source. Notes can clarify the record;
            they never collapse it into a total.
          </p>
        </div>
        <div className="ri-case fw-mono">
          <div>FW-DEV-eng-01-v2</div>
          <div>capture sealed · 14:32 UTC</div>
        </div>
      </header>

      <nav className="ri-filters" aria-label="Moment filters" {...regionProps("filters", "Moment filters", "control")}>
        {[
          ["All moments", true],
          ["Framing", false],
          ["Verification", false],
          ["Handoff risk", false],
        ].map(([label, active]) => (
          <button key={String(label)} className="ri-filter" type="button" data-active={active}>
            {label}
          </button>
        ))}
      </nav>

      <section {...regionProps("moment-index", "Source-linked moment index", "list", "Each row opens its trace")}>
        <div className="ri-index">
          <div className="ri-columns" aria-hidden="true">
            <span>Time</span><span>Moment</span><span>Observation</span><span>Source</span>
          </div>
          {moments.map((moment) => (
            <a className="ri-row" key={moment.id} href={`/embed/review-source#${moment.id}`}>
              <time className="ri-time">{moment.time}</time>
              <span className="ri-kind" data-kind={moment.kind}>{moment.kind}</span>
              <span className="ri-observation">{moment.observation}</span>
              <span className="ri-source">
                <span className="ri-source-path">↗ {moment.source}</span>
                {moment.trace}
              </span>
            </a>
          ))}
        </div>
      </section>

      <aside className="ri-mixed" {...regionProps("mixed-note", "Mixed evidence note", "note")}>
        <div>
          <strong>The record stays mixed.</strong>
          <span>The focused check is useful evidence; the missed stale-entry path remains beside it.</span>
        </div>
        <span className="fw-pill">unresolved · verification depth</span>
      </aside>
    </SurfaceShell>
  );
}
