/**
 * Candidate · Handoff — the one deliberate mode flip.
 *
 * Direction §11: the only moment the hierarchy inverts. The dark instrument
 * recedes to a smaller recap column ("your work is still here; now describe
 * it") while a light, document-like writing surface takes the hero — three
 * calm prompts: what changed · what still carries risk · the next step you'd
 * take. Framed "leave it safe for the next person," never "submit your test."
 * The candidate's own marks are pre-loaded beside it. They leave seeing
 * exactly what a reviewer will see.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.ho-root {
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
  --instr-ink: #e7e6e2;
  --instr-faint: #8d8b86;
  --instr-line: rgba(255, 255, 255, 0.07);
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --sans: "Inter", "Inter Tight", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;

  position: absolute;
  inset: 0;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  overflow-y: auto;
}
.ho-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 40px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 56px 32px 96px;
  align-items: start;
}
@media (max-width: 900px) { .ho-wrap { grid-template-columns: 1fr; } }

.ho-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.ho-title {
  font-family: var(--serif);
  font-size: 40px;
  line-height: 1.05;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin: 14px 0 0;
}
.ho-lede { font-size: 16px; line-height: 1.55; color: var(--soft); margin: 14px 0 0; max-width: 52ch; }

/* Writing surface — document-like, the hero. */
.ho-prompt { margin-top: 32px; }
.ho-prompt-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 8px;
}
.ho-field {
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 16px 18px;
  min-height: 88px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
}
.ho-field[data-empty="true"] { color: var(--faint); }
.ho-field-caret {
  display: inline-block;
  width: 2px; height: 18px;
  background: var(--ink);
  vertical-align: text-bottom;
  margin-left: 1px;
}

.ho-submit-row { margin-top: 32px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.ho-submit {
  appearance: none;
  border: none;
  font-family: var(--sans);
  font-size: 15px;
  font-weight: 600;
  color: var(--raised);
  background: var(--ink);
  border-radius: 8px;
  padding: 13px 26px;
  cursor: default;
}
.ho-submit-note { font-size: 13px; line-height: 1.5; color: var(--faint); max-width: 34ch; }

/* Recap column — the receded instrument + proof chain + pre-loaded notes. */
.ho-col { display: grid; gap: 20px; }
.ho-recap {
  background: var(--instr);
  color: var(--instr-ink);
  border-radius: 12px;
  overflow: hidden;
}
.ho-recap-head {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--instr-faint);
  padding: 14px 16px 10px;
}
.ho-recap-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid var(--instr-line);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--instr-ink);
}
.ho-recap-diff { display: inline-flex; gap: 8px; }
.ho-add { color: var(--proof-pass); }
.ho-del { color: var(--instr-faint); }
.ho-proof {
  padding: 12px 16px 16px;
  border-top: 1px solid var(--instr-line);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.7;
}
.ho-proof-cmd { color: var(--instr-faint); }
.ho-proof-pass { color: var(--proof-pass); }

.ho-notes {
  background: #f4efe4;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 16px 18px;
}
.ho-notes-head {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 4px;
}
.ho-notes-sub { font-size: 12px; line-height: 1.5; color: var(--soft); margin-bottom: 14px; }
.ho-note {
  font-family: var(--serif);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
  padding: 10px 0;
  border-top: 1px solid var(--hairline);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: baseline;
}
.ho-note:first-of-type { border-top: none; }
.ho-note-time { font-family: var(--mono); font-size: 11px; color: var(--faint); }

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

const NOTES = [
  { t: "58:04", body: "Unknown status was falling through to the amount check — that's the leak." },
  { t: "41:12", body: "Chose to route unknown to review rather than deny; safer for a real customer." },
  { t: "22:47", body: "Pinned it with a test so the boundary can't drift back quietly." },
];

export function CandidateHandoff() {
  return (
    <div className="ho-root">
      <style>{CSS}</style>
      <div className="ho-wrap">
        <section>
          <div className="ho-eyebrow">Engineer · Handoff</div>
          <h1
            className="ho-title"
            data-paper-region="title"
            data-paper-label="Title"
            data-paper-role="title"
          >
            Leave it safe for the next person.
          </h1>
          <p className="ho-lede">
            Not a test to submit — a handoff to write. Say what you changed, what
            still carries risk, and the step you'd take next.
          </p>

          <div
            className="ho-writing"
            data-paper-region="writing"
            data-paper-label="Writing surface"
            data-paper-role="section"
            data-paper-note="Three calm prompts — the document-like hero."
          >
            <div className="ho-prompt">
              <div className="ho-prompt-label">What changed</div>
              <div className="ho-field">
                Unknown-eligibility claims now route to manual review instead of
                silently returning eligible. The $500 line is unchanged.
              </div>
            </div>
            <div className="ho-prompt">
              <div className="ho-prompt-label">What still carries risk</div>
              <div className="ho-field">
                The ledger snapshot is a week old — if the "unknown" status set
                has grown, review volume could spike. Worth a metric before
                widening the flag.<span className="ho-field-caret" />
              </div>
            </div>
            <div className="ho-prompt">
              <div className="ho-prompt-label">The next step you'd take</div>
              <div className="ho-field" data-empty="true">
                Roll out behind eligibility_v2 to 5%, watch the review queue for a
                day, then decide…
              </div>
            </div>
          </div>

          <div
            className="ho-submit-row"
            data-paper-region="submit"
            data-paper-label="Submit"
            data-paper-role="control"
            data-paper-note="Calm and final — flows into the quiet close."
          >
            <button type="button" className="ho-submit">Leave the handoff</button>
            <span className="ho-submit-note">
              Your work is saved as you go. No score is generated — a person reads this.
            </span>
          </div>
        </section>

        <aside className="ho-col">
          <div
            className="ho-recap"
            data-paper-region="recap"
            data-paper-label="Work recap + proof"
            data-paper-role="evidence"
            data-paper-note="Receded instrument — what shipped and your own passing proof."
          >
            <div className="ho-recap-head">What shipped</div>
            <div className="ho-recap-file">
              <span>eligibility.ts</span>
              <span className="ho-recap-diff">
                <span className="ho-add">+6</span>
                <span className="ho-del">−2</span>
              </span>
            </div>
            <div className="ho-recap-file">
              <span>eligibility.test.ts</span>
              <span className="ho-recap-diff">
                <span className="ho-add">+14</span>
                <span className="ho-del">−0</span>
              </span>
            </div>
            <div className="ho-proof">
              <div className="ho-proof-cmd">$ bun test eligibility.test.ts</div>
              <div><span className="ho-proof-pass">✓</span> unknown status routes to review</div>
              <div><span className="ho-proof-pass">✓</span> holds the $500 review line</div>
              <div className="ho-proof-pass">2 pass · 0 fail</div>
            </div>
          </div>

          <div
            className="ho-notes"
            data-paper-region="notes"
            data-paper-label="Pre-loaded notes"
            data-paper-role="section"
            data-paper-note="The candidate's own margin marks, carried into the handoff."
          >
            <div className="ho-notes-head">Your notes</div>
            <div className="ho-notes-sub">
              Yours. Carried here from your session — pull any into the handoff.
            </div>
            {NOTES.map((n) => (
              <div key={n.t} className="ho-note">
                <span className="ho-note-time">{n.t}</span>
                <span>{n.body}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
