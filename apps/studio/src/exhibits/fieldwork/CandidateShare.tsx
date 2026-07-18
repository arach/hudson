/**
 * Candidate · Share — optional portable proof glance.
 *
 * Quiet mid-session (or post) sheet: what can travel with the candidate,
 * same retention rules as the session, never a feed or a score. The work is
 * still in the room behind a soft veil — this is not a social post.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.sh-root {
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

.sh-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--raised);
  border-bottom: 1px solid var(--hairline);
}
.sh-id { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.sh-role {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.sh-title-sm { font-family: var(--serif); font-size: 16px; color: var(--ink); }
.sh-status { display: flex; align-items: center; gap: 14px; }
.sh-clock {
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.sh-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--capture);
}
.sh-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--capture);
}

/* Soft instrument veil behind the sheet */
.sh-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  display: grid;
  place-items: center;
  padding: 28px 20px 40px;
  overflow: auto;
}
.sh-instrument {
  position: absolute;
  inset: 24px 28px 28px;
  border-radius: 12px;
  background: var(--instr);
  opacity: 0.22;
  pointer-events: none;
  overflow: hidden;
}
.sh-instr-bar {
  height: 36px;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--instr-line);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
}
.sh-tab {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--instr-faint);
}
.sh-tab[data-on="true"] { color: var(--instr-ink); }
.sh-code {
  padding: 16px 18px;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.65;
  color: var(--instr-faint);
  white-space: pre;
}

/* The share sheet — calm raised card over the room */
.sh-sheet {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 14px;
  box-shadow:
    0 1px 0 rgba(33, 31, 28, 0.04),
    0 18px 48px rgba(33, 31, 28, 0.10);
  padding: 28px 28px 24px;
  animation: sh-rise 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes sh-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.sh-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.sh-heading {
  font-family: var(--serif);
  font-size: 28px;
  line-height: 1.12;
  font-weight: 500;
  letter-spacing: -0.015em;
  margin: 12px 0 0;
}
.sh-lede {
  font-size: 15px;
  line-height: 1.55;
  color: var(--soft);
  margin: 12px 0 0;
  max-width: 42ch;
}

.sh-block {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--hairline);
}
.sh-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 12px;
}
.sh-rows { display: grid; gap: 10px; }
.sh-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  align-items: start;
  font-size: 14px;
  line-height: 1.45;
}
.sh-row dt {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  margin: 0;
  padding-top: 2px;
}
.sh-row dd { margin: 0; color: var(--ink); }
.sh-row dd span { color: var(--soft); }

.sh-never {
  display: grid;
  gap: 8px;
}
.sh-never li {
  list-style: none;
  display: grid;
  grid-template-columns: 8px 1fr;
  gap: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--soft);
}
.sh-never li::before {
  content: "";
  width: 6px; height: 6px; margin-top: 6px;
  border-radius: 50%;
  background: var(--faint);
}

.sh-retention {
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--sunken);
  border-radius: 8px;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--soft);
  letter-spacing: 0.02em;
}

.sh-actions {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.sh-btn {
  appearance: none;
  border: none;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  padding: 11px 18px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--raised);
  cursor: default;
}
.sh-btn[data-tone="quiet"] {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--edge);
}

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .sh-sheet { animation: none; }
}
`;

export function CandidateShare() {
  return (
    <div className="sh-root">
      <style>{CSS}</style>

      <header className="sh-header">
        <div className="sh-id">
          <span className="sh-role">Engineer</span>
          <span className="sh-title-sm">Eligibility boundary</span>
        </div>
        <div className="sh-status">
          <span className="sh-clock">52:14</span>
          <span
            className="sh-chip"
            data-paper-region="capture"
            data-paper-label="Capture chip"
            data-paper-role="signal"
          >
            <span className="sh-dot" /> Recording
          </span>
        </div>
      </header>

      <div className="sh-stage">
        <div className="sh-instrument" aria-hidden="true">
          <div className="sh-instr-bar">
            <span className="sh-tab" data-on="true">decision.ts</span>
            <span className="sh-tab">test</span>
            <span className="sh-tab">run</span>
          </div>
          <div className="sh-code">{`export function decide(claim) {
  if (claim.eligibility === "unknown") {
    return { action: "hold", reason: "…" }
  }
  // …`}</div>
        </div>

        <article
          className="sh-sheet"
          data-paper-region="sheet"
          data-paper-label="Proof sheet"
          data-paper-role="section"
          data-paper-note="Optional portable proof — not a feed, not a score."
        >
          <div className="sh-eyebrow">Optional · Yours to keep</div>
          <h1
            className="sh-heading"
            data-paper-region="title"
            data-paper-label="Title"
            data-paper-role="title"
          >
            Leave a clean trail.
          </h1>
          <p className="sh-lede">
            A short, portable proof of what you made — for you, and for the
            people who review this session later. Not a score. Not a feed.
          </p>

          <div
            className="sh-block"
            data-paper-region="travels"
            data-paper-label="What travels"
            data-paper-role="section"
          >
            <div className="sh-label">What can travel with you</div>
            <dl className="sh-rows">
              <div className="sh-row">
                <dt>artifact</dt>
                <dd>
                  decision.ts <span>· tests green · brief note on risk</span>
                </dd>
              </div>
              <div className="sh-row">
                <dt>proof</dt>
                <dd>
                  bun test <span>· 12 passed · exit 0</span>
                </dd>
              </div>
              <div className="sh-row">
                <dt>handoff</dt>
                <dd>
                  Your words only <span>· when you finish the session</span>
                </dd>
              </div>
            </dl>
          </div>

          <div
            className="sh-block"
            data-paper-region="never"
            data-paper-label="Never included"
            data-paper-role="section"
          >
            <div className="sh-label">Never included</div>
            <ul className="sh-never">
              <li>Face, voice analysis, keystroke biometrics</li>
              <li>Personality scores or hire / no-hire labels</li>
              <li>Anything outside the declared capture policy</li>
            </ul>
            <div className="sh-retention">
              retention · 30 days · same rules as the rest of the session
            </div>
          </div>

          <div
            className="sh-actions"
            data-paper-region="actions"
            data-paper-label="Actions"
            data-paper-role="control"
          >
            <button type="button" className="sh-btn">
              Continue work
            </button>
            <button type="button" className="sh-btn" data-tone="quiet">
              Save proof summary
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
