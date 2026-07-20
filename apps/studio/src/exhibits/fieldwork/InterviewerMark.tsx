/**
 * Interviewer · Mark — one frictionless moment mark.
 *
 * Support attention, not real-time grading. One key / click, optional one-line
 * why. No modal takeover. Deeper notes wait for review.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.im-root {
  --room: #ece9e2;
  --raised: #f8f6f1;
  --sunken: #e5e1d8;
  --ink: #211f1c;
  --soft: #5b5952;
  --faint: #8c897f;
  --hairline: rgba(33, 31, 28, 0.10);
  --edge: rgba(33, 31, 28, 0.16);
  --capture: #5a7d86;
  --proof-pass: #3f8f6b;
  --instr: #1b1c20;
  --instr-raised: #25262b;
  --instr-ink: #e7e6e2;
  --instr-faint: #8d8b86;
  --instr-line: rgba(255, 255, 255, 0.07);
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --sans: "Inter", "Inter Tight", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;

  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.im-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--raised);
  border-bottom: 1px solid var(--hairline);
}
.im-id { display: flex; align-items: baseline; gap: 12px; }
.im-role {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.im-title-sm { font-family: var(--serif); font-size: 16px; color: var(--ink); }
.im-status { display: flex; align-items: center; gap: 14px; }
.im-clock {
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.im-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--capture);
}
.im-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--capture); }

.im-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
}

.im-instrument {
  min-width: 0;
  margin: 12px 0 12px 12px;
  border-radius: 12px;
  background: var(--instr);
  color: var(--instr-ink);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0,0,0,0.12);
  position: relative;
}
.im-tabs {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 10px;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--instr-line);
}
.im-tab {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--instr-faint);
  padding: 6px 12px;
}
.im-tab[data-on="true"] { color: var(--instr-ink); }
.im-code {
  flex: 1;
  padding: 20px 22px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--instr-ink);
  white-space: pre;
}
.im-code .c { color: var(--instr-faint); }
.im-code .line-mark {
  display: block;
  margin: 0 -22px;
  padding: 0 22px;
  background: color-mix(in srgb, #c4a574 12%, transparent);
  box-shadow: inset 3px 0 0 #c4a574;
}

/* Slip of paper — optional why, no modal takeover */
.im-slip {
  position: absolute;
  left: 48px;
  bottom: 28px;
  width: min(340px, calc(100% - 64px));
  background: var(--raised);
  color: var(--ink);
  border: 1px solid var(--edge);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.28);
  padding: 14px 16px 12px;
  animation: im-slip 200ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes im-slip {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
.im-slip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.im-slip-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.im-slip-time {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
}
.im-slip-input {
  min-height: 52px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--sunken);
  border: 1px solid var(--hairline);
  font-size: 14px;
  line-height: 1.45;
  color: var(--ink);
}
.im-slip-input span { color: var(--faint); }
.im-slip-foot {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.im-slip-hint {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}
.im-save {
  appearance: none;
  border: none;
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 7px;
  background: var(--ink);
  color: var(--raised);
  cursor: default;
}

/* Marks list — quiet, not a gradebook */
.im-rail {
  margin: 12px 12px 12px 10px;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.im-rail-head {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--hairline);
}
.im-rail-eyebrow {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.im-rail-title {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 500;
  margin: 8px 0 0;
  line-height: 1.15;
}
.im-rail-sub {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--soft);
}
.im-list {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}
.im-item {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hairline);
}
.im-item:last-child { border-bottom: none; }
.im-item-time {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  padding-top: 2px;
}
.im-item-body {
  font-size: 13px;
  line-height: 1.45;
  color: var(--ink);
}
.im-item-body span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: var(--soft);
}
.im-item[data-new="true"] {
  background: color-mix(in srgb, var(--capture) 6%, transparent);
}

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .im-slip { animation: none; }
}
`;

const MARKS = [
  {
    t: "18:42",
    title: "Framed eligibility as a decision boundary",
    note: "Not a data-cleanup task",
  },
  {
    t: "31:05",
    title: "Rejected AI suggestion on refund path",
    note: "Would have silently approved unknown",
  },
  {
    t: "44:10",
    title: "First green tests",
    note: "bun test · 12 passed",
  },
] as const;

export function InterviewerMark() {
  return (
    <div className="im-root">
      <style>{CSS}</style>

      <header className="im-header">
        <div className="im-id">
          <span className="im-role">Live · Interviewer</span>
          <span className="im-title-sm">Mark this moment</span>
        </div>
        <div className="im-status">
          <span className="im-clock">44:12</span>
          <span className="im-chip">
            <span className="im-dot" /> Capture on
          </span>
        </div>
      </header>

      <div className="im-body">
        <section
          className="im-instrument"
          data-paper-region="instrument"
          data-paper-label="Work + mark slip"
          data-paper-role="section"
        >
          <div className="im-tabs">
            <span className="im-tab" data-on="true">decision.ts</span>
            <span className="im-tab">run</span>
          </div>
          <div className="im-code">
            <span className="c">{"// unknown must not recommend refunds"}</span>
            {"\n"}
            {"if (claim.eligibility === \"unknown\") {\n"}
            <span className="line-mark">
              {"  return { action: \"hold\", reason: \"…\" }"}
            </span>
            {"\n}\n"}
          </div>

          <div
            className="im-slip"
            data-paper-region="composer"
            data-paper-label="Mark composer"
            data-paper-role="control"
            data-paper-note="Optional one-line why. Enter saves, Esc dismisses."
          >
            <div className="im-slip-head">
              <span className="im-slip-label">Mark · optional why</span>
              <span className="im-slip-time">44:12</span>
            </div>
            <div className="im-slip-input">
              <span>Caught a false green · changed scope · good AI catch…</span>
            </div>
            <div className="im-slip-foot">
              <span className="im-slip-hint">⌘M · Esc dismiss · Enter save</span>
              <button type="button" className="im-save">
                Save mark
              </button>
            </div>
          </div>
        </section>

        <aside
          className="im-rail"
          data-paper-region="recent"
          data-paper-label="Session marks"
          data-paper-role="section"
          data-paper-note="Light marks for attention — not a live gradebook."
        >
          <div className="im-rail-head">
            <div className="im-rail-eyebrow">This session</div>
            <h1 className="im-rail-title">Your marks</h1>
            <p className="im-rail-sub">
              Support attention now. Notes can deepen later in review.
            </p>
          </div>
          <div className="im-list">
            {MARKS.map((m, i) => (
              <div
                key={m.t}
                className="im-item"
                data-new={i === MARKS.length - 1 ? "true" : undefined}
              >
                <span className="im-item-time">{m.t}</span>
                <div className="im-item-body">
                  {m.title}
                  <span>{m.note}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
