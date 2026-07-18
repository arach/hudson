/**
 * Candidate · Active Work — the instrument in the room.
 *
 * The core law made physical (direction §6): one dark instrument, one light
 * margin, nothing else persistent. Light = what Fieldwork prepared for you;
 * dark = your work. The room never watches; the clock and a single calm
 * capture chip are the only status in the header.
 *
 * Sketch — look-and-feel, not wired. Self-contained (own tokens + type) so it
 * renders identically standalone (Paper card iframe) and inside Studio.
 */

const CSS = `
.aw-root {
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

/* Header — 56px, raised. Identity left, clock + single capture home right. */
.aw-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--raised);
  border-bottom: 1px solid var(--hairline);
}
.aw-id { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.aw-id-role {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.aw-id-title {
  font-family: var(--serif);
  font-size: 16px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aw-status { display: flex; align-items: center; gap: 14px; flex: none; }
.aw-clock {
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.aw-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--capture);
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--capture) 32%, transparent);
  background: color-mix(in srgb, var(--capture) 8%, transparent);
}
.aw-chip-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--capture);
  animation: aw-breath 4s ease-in-out infinite;
}
@keyframes aw-breath { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
.aw-end {
  font-family: var(--sans);
  font-size: 13px;
  color: var(--soft);
  background: transparent;
  border: 1px solid var(--edge);
  border-radius: 7px;
  padding: 6px 14px;
  cursor: default;
}

/* Body — margin | instrument | AI rail */
.aw-body { flex: 1; display: flex; min-height: 0; }

/* Margin (~260px parchment) — the brief. Reference only. */
.aw-margin {
  flex: none;
  width: 260px;
  padding: 22px 20px;
  background: var(--raised);
  border-right: 1px solid var(--hairline);
  overflow-y: auto;
}
.aw-m-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 8px;
}
.aw-m-label:not(:first-child) { margin-top: 26px; }
.aw-m-outcome { font-size: 14px; line-height: 1.5; color: var(--ink); }
.aw-m-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
.aw-m-list li {
  display: grid; grid-template-columns: 6px 1fr; gap: 10px; align-items: start;
  font-size: 13px; line-height: 1.45; color: var(--soft);
}
.aw-m-list li::before {
  content: ""; width: 5px; height: 5px; margin-top: 6px;
  border-radius: 50%; background: var(--faint);
}
.aw-m-list code { font-family: var(--mono); font-size: 12px; color: var(--ink); }

/* Instrument — dominant dark work object */
.aw-instr {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--instr);
  color: var(--instr-ink);
}
.aw-tabs {
  flex: none;
  display: flex;
  align-items: stretch;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--instr-line);
}
.aw-tab {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--instr-faint);
  padding: 12px 16px;
  border-right: 1px solid var(--instr-line);
}
.aw-tab[data-active="true"] {
  color: var(--instr-ink);
  background: var(--instr);
  box-shadow: inset 0 -2px 0 var(--capture);
}
.aw-editor {
  flex: 1;
  min-height: 0;
  overflow: auto;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  padding: 16px 0;
}
.aw-line { display: grid; grid-template-columns: 44px 1fr; }
.aw-line[data-hot="true"] { background: rgba(255,255,255,0.035); }
.aw-gutter {
  text-align: right;
  padding-right: 16px;
  color: var(--instr-faint);
  opacity: 0.7;
  user-select: none;
}
.aw-code { color: var(--instr-ink); white-space: pre; padding-right: 24px; }
.aw-kw { color: #7fa8c9; }
.aw-str { color: #b7c48f; }
.aw-cm { color: var(--instr-faint); }
/* candidate margin pencil — quiet, graphite, bottom-left of gutter */
.aw-pencil {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--instr-line);
  font-family: var(--mono);
  font-size: 11px;
  color: var(--instr-faint);
}
.aw-pencil svg { opacity: 0.7; }

/* Run strip — bun test proof, the only place --proof-pass appears */
.aw-run {
  flex: none;
  background: #17181c;
  border-top: 1px solid var(--instr-line);
  padding: 12px 16px 14px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
}
.aw-run-cmd { color: var(--instr-ink); }
.aw-run-cmd::before { content: "$ "; color: var(--instr-faint); }
.aw-run-out { color: var(--instr-faint); }
.aw-run-pass { color: var(--proof-pass); }

/* AI rail (~340px) — inside the dark object. Declared, honest, never coached. */
.aw-rail {
  flex: none;
  width: 340px;
  display: flex;
  flex-direction: column;
  background: var(--instr);
  border-left: 1px solid var(--instr-line);
}
.aw-rail-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--capture-line, var(--instr-line));
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--capture) 40%, transparent);
}
.aw-rail-model { font-family: var(--mono); font-size: 12px; color: var(--instr-ink); }
.aw-rail-allowed {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--instr-faint);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--instr-line);
}
.aw-rail-body { flex: 1; overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
.aw-turn { display: grid; gap: 6px; }
.aw-turn-who {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--instr-faint);
}
.aw-turn-body {
  font-family: var(--sans);
  font-size: 13px;
  line-height: 1.55;
  color: var(--instr-ink);
}
.aw-turn[data-who="you"] .aw-turn-body { color: color-mix(in srgb, var(--instr-ink) 82%, transparent); }
.aw-rail-input {
  flex: none;
  margin: 0 16px 16px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--instr-line);
  background: rgba(255,255,255,0.03);
  font-family: var(--sans);
  font-size: 13px;
  color: var(--instr-faint);
}
.aw-rail-foot {
  flex: none;
  padding: 0 16px 14px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--capture) 70%, var(--instr-faint));
}

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: -2px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .aw-chip-dot { animation: none; }
}
`;

const PENCIL = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M8.4 1.6 10.4 3.6 4 10H2v-2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);

const CODE_LINES: Array<{ n: number; hot?: boolean; parts: Array<{ t: string; c?: string }> }> = [
  { n: 41, parts: [{ t: "// refunds over $500 stay behind manual review", c: "aw-cm" }] },
  { n: 42, parts: [{ t: "export function ", c: "aw-kw" }, { t: "isEligible(claim) {" }] },
  { n: 43, parts: [{ t: "  if ", c: "aw-kw" }, { t: "(claim.status === " }, { t: '"unknown"', c: "aw-str" }, { t: ") {" }] },
  { n: 44, hot: true, parts: [{ t: "    // ← the boundary the room asked you to make honest", c: "aw-cm" }] },
  { n: 45, parts: [{ t: "    return ", c: "aw-kw" }, { t: "requiresReview(claim);" }] },
  { n: 46, parts: [{ t: "  }" }] },
  { n: 47, parts: [{ t: "  return ", c: "aw-kw" }, { t: "claim.amount <= " }, { t: "500", c: "aw-str" }, { t: ";" }] },
  { n: 48, parts: [{ t: "}" }] },
];

export function CandidateActiveWork() {
  return (
    <div className="aw-root">
      <style>{CSS}</style>

      <header
        className="aw-header"
        data-paper-region="header"
        data-paper-label="Header"
        data-paper-role="header"
        data-paper-note="Identity · clock · single capture chip. No tools."
      >
        <div className="aw-id">
          <span className="aw-id-role">Engineer</span>
          <span className="aw-id-title">Make the decision boundary honest.</span>
        </div>
        <div className="aw-status">
          <span className="aw-clock">71:12</span>
          <span className="aw-chip">
            <span className="aw-chip-dot" />
            Recording
          </span>
          <button type="button" className="aw-end">Hand off</button>
        </div>
      </header>

      <div className="aw-body">
        <aside
          className="aw-margin"
          data-paper-region="margin"
          data-paper-label="Brief margin"
          data-paper-role="section"
          data-paper-note="Prepared desk — outcome, materials, constraints. Reference only."
        >
          <div className="aw-m-label">Outcome</div>
          <p className="aw-m-outcome">
            Make the decision boundary honest again — decide what the code should
            do at the edges, and leave it safe for the next person.
          </p>
          <div className="aw-m-label">Materials</div>
          <ul className="aw-m-list">
            <li><code>billing/eligibility.ts</code></li>
            <li>Read-only ledger snapshot</li>
            <li>Incident #4821 — timeout report</li>
          </ul>
          <div className="aw-m-label">Hold true</div>
          <ul className="aw-m-list">
            <li>The ledger is read-only.</li>
            <li>Refunds over $500 stay behind review.</li>
            <li>Ship behind <code>eligibility_v2</code>.</li>
          </ul>
        </aside>

        <main
          className="aw-instr"
          data-paper-region="instrument"
          data-paper-label="Instrument"
          data-paper-role="instrument"
          data-paper-note="Dominant dark work object — editor, run strip, one surface."
        >
          <div className="aw-tabs">
            <span className="aw-tab" data-active="true">eligibility.ts</span>
            <span className="aw-tab">eligibility.test.ts</span>
            <span className="aw-tab">Terminal</span>
          </div>
          <div className="aw-editor">
            {CODE_LINES.map((line) => (
              <div key={line.n} className="aw-line" data-hot={line.hot ? "true" : undefined}>
                <span className="aw-gutter">{line.n}</span>
                <span className="aw-code">
                  {line.parts.map((p, i) => (
                    <span key={i} className={p.c}>{p.t}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="aw-pencil">
            {PENCIL}
            <span>⌘M — drop a mark in the margin. Yours, and only yours.</span>
          </div>
          <div
            className="aw-run"
            data-paper-region="run"
            data-paper-label="Run strip"
            data-paper-role="evidence"
            data-paper-note="Proof — bun test output. Passing reads as proof, quietly."
          >
            <div className="aw-run-cmd">bun test eligibility.test.ts</div>
            <div className="aw-run-out">
              <span className="aw-run-pass">✓</span> holds the $500 review line
            </div>
            <div className="aw-run-out">
              <span className="aw-run-pass">✓</span> unknown status routes to review
            </div>
            <div className="aw-run-out">
              <span className="aw-run-pass">2 pass</span> · 0 fail · 340ms
            </div>
          </div>
        </main>

        <aside
          className="aw-rail"
          data-paper-region="ai-rail"
          data-paper-label="AI rail"
          data-paper-role="section"
          data-paper-note="Declared model inside the instrument. Honest, recorded, never coached."
        >
          <div className="aw-rail-head">
            <span className="aw-rail-model">Claude</span>
            <span className="aw-rail-allowed">Declared · allowed</span>
          </div>
          <div className="aw-rail-body">
            <div className="aw-turn" data-who="you">
              <span className="aw-turn-who">You</span>
              <span className="aw-turn-body">
                What breaks if an unknown claim silently returns eligible?
              </span>
            </div>
            <div className="aw-turn" data-who="claude">
              <span className="aw-turn-who">Claude</span>
              <span className="aw-turn-body">
                Refunds get auto-approved past the review line. Route unknown to
                <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}> requiresReview</code>{" "}
                and pin it with a test — but confirm the amount check still runs after.
              </span>
            </div>
          </div>
          <div className="aw-rail-input">Ask, direct, or paste — your prompts travel with the work…</div>
          <div className="aw-rail-foot">◐ AI turns are part of the work record.</div>
        </aside>
      </div>
    </div>
  );
}
