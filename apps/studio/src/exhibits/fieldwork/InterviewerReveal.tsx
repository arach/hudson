/**
 * Interviewer · Reveal — a human knock, not a system alert.
 *
 * Pre-authored, source-linked pressure arrives as a person speaking.
 * Quiet header affordance in --voice; calm band on the instrument edge.
 * No “twist,” badge, toast, or urgency styling.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.ir-root {
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

.ir-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--raised);
  border-bottom: 1px solid var(--hairline);
}
.ir-id { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.ir-role {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.ir-title-sm { font-family: var(--serif); font-size: 16px; color: var(--ink); }
.ir-status { display: flex; align-items: center; gap: 14px; }
.ir-clock {
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.ir-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--capture);
}
.ir-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--capture); }

/* Human knock — voice hue only when a person speaks */
.ir-knock {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--voice);
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--voice) 35%, transparent);
  background: color-mix(in srgb, var(--voice) 8%, var(--raised));
}
.ir-knock-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--voice);
}

.ir-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 12px;
  border-radius: 12px;
  background: var(--instr);
  color: var(--instr-ink);
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.12);
}

.ir-tabs {
  flex: none;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 10px;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--instr-line);
}
.ir-tab {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--instr-faint);
  padding: 6px 12px;
}
.ir-tab[data-on="true"] { color: var(--instr-ink); }

.ir-work {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
}
.ir-editor {
  padding: 20px 22px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  overflow: auto;
  white-space: pre;
  border-right: 1px solid var(--instr-line);
}
.ir-editor .c { color: var(--instr-faint); }
.ir-side {
  padding: 16px;
  background: color-mix(in srgb, var(--instr-raised) 80%, black);
  overflow: auto;
}
.ir-side-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--instr-faint);
  margin-bottom: 12px;
}
.ir-ai {
  font-size: 13px;
  line-height: 1.5;
  color: var(--instr-faint);
}
.ir-ai b {
  display: block;
  color: var(--instr-ink);
  font-weight: 500;
  margin-bottom: 6px;
}

/* Calm human band — docks at instrument foot, --voice only */
.ir-band {
  flex: none;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: start;
  padding: 16px 18px;
  background: color-mix(in srgb, var(--voice) 12%, var(--raised));
  color: var(--ink);
  border-top: 1px solid color-mix(in srgb, var(--voice) 28%, transparent);
  animation: ir-settle 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes ir-settle {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.ir-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--voice) 18%, transparent);
  color: var(--voice);
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 500;
}
.ir-msg-from {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--voice);
  margin-bottom: 6px;
}
.ir-msg-text {
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  max-width: 62ch;
}
.ir-msg-meta {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  margin-top: 8px;
}
.ir-stance {
  align-self: center;
  max-width: 160px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--soft);
  text-align: right;
}

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .ir-band { animation: none; }
}
`;

export function InterviewerReveal() {
  return (
    <div className="ir-root">
      <style>{CSS}</style>

      <header className="ir-header">
        <div className="ir-id">
          <span className="ir-role">Live · Candidate room</span>
          <span className="ir-title-sm">Eligibility boundary</span>
        </div>
        <div className="ir-status">
          <span className="ir-clock">38:20</span>
          <span className="ir-chip">
            <span className="ir-dot" /> Recording
          </span>
          <span
            className="ir-knock"
            data-paper-region="knock"
            data-paper-label="Human knock"
            data-paper-role="signal"
            data-paper-note="Voice hue only. No red badge, no toast."
          >
            <span className="ir-knock-dot" />
            Dana · 1 note
          </span>
        </div>
      </header>

      <div
        className="ir-main"
        data-paper-region="room"
        data-paper-label="Work room"
        data-paper-role="section"
      >
        <div className="ir-tabs">
          <span className="ir-tab" data-on="true">decision.ts</span>
          <span className="ir-tab">test</span>
          <span className="ir-tab">Claude</span>
        </div>

        <div className="ir-work">
          <div className="ir-editor">
            <span className="c">{"// candidate is mid-change"}</span>
            {"\n"}
            {"export function decide(claim: Claim) {\n"}
            {"  if (claim.eligibility === \"unknown\") {\n"}
            {"    return { action: \"hold\" }\n"}
            {"  }\n"}
            {"  // still open: timeout path\n"}
            {"}"}
          </div>
          <div className="ir-side">
            <div className="ir-side-label">Declared tool · Claude · allowed</div>
            <div className="ir-ai">
              <b>Last turn</b>
              Candidate asked about refund defaults when eligibility is missing.
              Model suggested a soft approve — candidate has not accepted it.
            </div>
          </div>
        </div>

        <div
          className="ir-band"
          data-paper-region="message"
          data-paper-label="Human message band"
          data-paper-role="section"
          data-paper-note="A person changing constraints — human phrasing, human hue."
        >
          <div className="ir-avatar" aria-hidden="true">
            D
          </div>
          <div>
            <div className="ir-msg-from">Dana · interviewer</div>
            <p className="ir-msg-text">
              Timeouts have risen to 18%. The review queue breaches SLA within
              the hour. What changes?
            </p>
            <div className="ir-msg-meta">
              at 38:20 · source-linked · waits for the candidate
            </div>
          </div>
          <div
            className="ir-stance"
            data-paper-region="stance"
            data-paper-label="Room stance"
            data-paper-role="body"
          >
            Quiet knock. Candidate answers when ready. Pressure is a true thing
            said — not a proctor event.
          </div>
        </div>
      </div>
    </div>
  );
}
