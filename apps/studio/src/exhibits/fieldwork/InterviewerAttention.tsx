/**
 * Interviewer · Attention — live orientation, not grading.
 *
 * Same work surface as the candidate (grounding). Right rail = what this
 * exercise probes as *context* — never a live scorecard. Default posture:
 * watch the work, mark lightly, judge later.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.ia-root {
  --room: #ece9e2;
  --raised: #f8f6f1;
  --sunken: #e5e1d8;
  --ink: #211f1c;
  --soft: #5b5952;
  --faint: #8c897f;
  --hairline: rgba(33, 31, 28, 0.10);
  --edge: rgba(33, 31, 28, 0.16);
  --capture: #5a7d86;
  --voice: #b0512f;
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

.ia-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--raised);
  border-bottom: 1px solid var(--hairline);
}
.ia-id { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.ia-role {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.ia-title-sm {
  font-family: var(--serif);
  font-size: 16px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ia-status { display: flex; align-items: center; gap: 14px; flex: none; }
.ia-clock {
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.ia-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--capture);
}
.ia-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--capture); }
.ia-mark-key {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
  padding: 5px 9px;
  border: 1px solid var(--hairline);
  border-radius: 6px;
}

.ia-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
}

/* Dark instrument — candidate work, read-only from this seat */
.ia-instrument {
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin: 12px 0 12px 12px;
  border-radius: 12px;
  background: var(--instr);
  color: var(--instr-ink);
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.12);
}
.ia-tabs {
  flex: none;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 10px;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--instr-line);
}
.ia-tab {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--instr-faint);
  padding: 6px 12px;
  border-radius: 6px 6px 0 0;
}
.ia-tab[data-on="true"] {
  color: var(--instr-ink);
  background: color-mix(in srgb, var(--instr) 40%, transparent);
}
.ia-editor {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 44px 1fr;
  overflow: auto;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.65;
}
.ia-gutter {
  padding: 16px 0;
  text-align: right;
  color: var(--instr-faint);
  user-select: none;
  border-right: 1px solid var(--instr-line);
}
.ia-gutter span { display: block; padding: 0 10px; opacity: 0.7; }
.ia-code {
  padding: 16px 18px;
  color: var(--instr-ink);
  white-space: pre;
}
.ia-code .c { color: var(--instr-faint); }
.ia-code .k { color: #8ab4a0; }
.ia-code .s { color: #c4a574; }

.ia-run {
  flex: none;
  border-top: 1px solid var(--instr-line);
  padding: 10px 16px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--instr-faint);
  display: flex;
  align-items: center;
  gap: 10px;
}
.ia-run b {
  color: var(--proof-pass);
  font-weight: 500;
}

/* Right rail — orientation only, never scoring */
.ia-rail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 12px 12px 12px 10px;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  overflow: hidden;
}
.ia-rail-head {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--hairline);
}
.ia-rail-eyebrow {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.ia-rail-title {
  font-family: var(--serif);
  font-size: 18px;
  line-height: 1.2;
  margin: 8px 0 0;
  font-weight: 500;
}
.ia-rail-body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px 18px;
}
.ia-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin: 16px 0 10px;
}
.ia-label:first-child { margin-top: 0; }
.ia-probes { display: grid; gap: 8px; }
.ia-probe {
  padding: 10px 12px;
  background: var(--sunken);
  border-radius: 8px;
}
.ia-probe b {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 3px;
}
.ia-probe span {
  font-size: 12px;
  line-height: 1.4;
  color: var(--soft);
}
.ia-posture {
  margin-top: 4px;
  padding: 12px;
  border: 1px dashed var(--edge);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--soft);
}
.ia-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ia-pill {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
  color: var(--soft);
}

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

const PROBES = [
  ["Frame", "Find the real job inside the brief"],
  ["Make", "Turn decisions into a useful artifact"],
  ["Verify", "Know what would prove the work wrong"],
  ["Hand off", "Leave it safe for the next person"],
] as const;

export function InterviewerAttention() {
  return (
    <div className="ia-root">
      <style>{CSS}</style>

      <header
        className="ia-header"
        data-paper-region="header"
        data-paper-label="Header"
        data-paper-role="chrome"
      >
        <div className="ia-id">
          <span className="ia-role">Live · Interviewer</span>
          <span className="ia-title-sm">Eligibility boundary · eng-01</span>
        </div>
        <div className="ia-status">
          <span className="ia-clock">42:18</span>
          <span className="ia-chip">
            <span className="ia-dot" /> Capture on
          </span>
          <span
            className="ia-mark-key"
            data-paper-region="mark-key"
            data-paper-label="Mark shortcut"
            data-paper-role="control"
            data-paper-note="One frictionless mark — notes wait for review."
          >
            ⌘M mark
          </span>
        </div>
      </header>

      <div className="ia-body">
        <section
          className="ia-instrument"
          data-paper-region="instrument"
          data-paper-label="Candidate work"
          data-paper-role="section"
          data-paper-note="Same surface the candidate sees — grounding, not surveillance chrome."
        >
          <div className="ia-tabs">
            <span className="ia-tab" data-on="true">decision.ts</span>
            <span className="ia-tab">decision.test.ts</span>
            <span className="ia-tab">run</span>
          </div>
          <div className="ia-editor">
            <div className="ia-gutter" aria-hidden="true">
              {[18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <div className="ia-code">
              <span className="c">{"// hold when eligibility is unknown"}</span>
              {"\n"}
              <span className="k">export function</span>
              {" decide(claim: Claim): Decision {\n"}
              {"  "}
              <span className="k">if</span>
              {" (claim.eligibility === "}
              <span className="s">"unknown"</span>
              {") {\n"}
              {"    "}
              <span className="k">return</span>
              {" {\n"}
              {"      action: "}
              <span className="s">"hold"</span>
              {",\n"}
              {"      reason: "}
              <span className="s">"unknown is not eligible"</span>
              {",\n"}
              {"    }\n"}
              {"  }\n"}
              {"  "}
              <span className="c">{"// …"}</span>
            </div>
          </div>
          <div className="ia-run">
            <b>● proof</b>
            <span>bun test · 12 passed · exit 0</span>
          </div>
        </section>

        <aside
          className="ia-rail"
          data-paper-region="orientation-rail"
          data-paper-label="Orientation rail"
          data-paper-role="section"
          data-paper-note="Criteria as context only — never a live scorecard."
        >
          <div className="ia-rail-head">
            <div className="ia-rail-eyebrow">Orientation · live</div>
            <h1 className="ia-rail-title">Watch the work, not the person.</h1>
          </div>
          <div className="ia-rail-body">
            <div className="ia-label">This exercise probes</div>
            <div className="ia-probes">
              {PROBES.map(([t, d]) => (
                <div key={t} className="ia-probe">
                  <b>{t}</b>
                  <span>{d}</span>
                </div>
              ))}
            </div>

            <div className="ia-label">Room</div>
            <div className="ia-meta">
              <span className="ia-pill">candidate · eng-01</span>
              <span className="ia-pill">75 min</span>
              <span className="ia-pill">AI allowed</span>
            </div>

            <div className="ia-label">Default posture</div>
            <p className="ia-posture">
              Mark moments lightly. Notes and threads can wait for review. The
              work is the hero — not your grading apparatus.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
