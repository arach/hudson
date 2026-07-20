/**
 * Candidate · Done — the quiet close.
 *
 * Direction §11: submit "flows into a quiet 'your work is saved · no score was
 * generated · a person decides' close." No celebration, no confetti, no
 * scorecard — the ethical spine held to the last frame. A calm, centered
 * column that lets the candidate leave trusting the room.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.dn-root {
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
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --sans: "Inter", "Inter Tight", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;

  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  overflow-y: auto;
}
.dn-column {
  width: 100%;
  max-width: 560px;
  padding: 64px 32px;
  text-align: center;
  animation: dn-settle 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes dn-settle { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.dn-mark {
  width: 44px; height: 44px;
  margin: 0 auto 24px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--proof-pass) 14%, transparent);
  color: var(--proof-pass);
}
.dn-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.dn-title {
  font-family: var(--serif);
  font-size: 34px;
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.015em;
  margin: 14px 0 0;
}
.dn-sub { font-size: 16px; line-height: 1.55; color: var(--soft); margin: 16px auto 0; max-width: 42ch; }

/* Facts — plain, honest, no scorecard. */
.dn-facts {
  margin: 36px auto 0;
  max-width: 420px;
  text-align: left;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  overflow: hidden;
}
.dn-fact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid var(--hairline);
}
.dn-fact:first-child { border-top: none; }
.dn-fact-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
.dn-fact-dot[data-tone="pass"] { background: var(--proof-pass); }
.dn-fact-dot[data-tone="capture"] { background: var(--capture); }
.dn-fact-body { font-size: 14px; line-height: 1.45; color: var(--ink); }
.dn-fact-body b { font-weight: 600; }
.dn-fact-body span { color: var(--soft); }

.dn-retention {
  margin: 24px auto 0;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--faint);
  max-width: 46ch;
}
.dn-close {
  margin-top: 32px;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--edge);
  border-radius: 8px;
  padding: 11px 24px;
  cursor: default;
}

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) { .dn-column { animation: none; } }
`;

const CHECK = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 10.5 8.5 14 15 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function CandidateDone() {
  return (
    <div className="dn-root">
      <style>{CSS}</style>
      <div className="dn-column">
        <div
          className="dn-mark"
          data-paper-region="mark"
          data-paper-label="Close mark"
          data-paper-role="signal"
          data-paper-note="Quiet moss check — proof, not celebration."
        >
          {CHECK}
        </div>
        <div className="dn-eyebrow">Engineer · Session complete</div>
        <h1
          className="dn-title"
          data-paper-region="title"
          data-paper-label="Title"
          data-paper-role="title"
        >
          Your work is saved.
        </h1>
        <p className="dn-sub">
          The room is closed. Nothing else is asked of you — what happens next is
          a decision a person makes, with your work in front of them.
        </p>

        <div
          className="dn-facts"
          data-paper-region="facts"
          data-paper-label="Close facts"
          data-paper-role="section"
          data-paper-note="Work saved · no score · a person decides. No scorecard, ever."
        >
          <div className="dn-fact">
            <span className="dn-fact-dot" data-tone="pass" />
            <span className="dn-fact-body">
              <b>Your handoff and work are saved</b> <span>— exactly as you left them.</span>
            </span>
          </div>
          <div className="dn-fact">
            <span className="dn-fact-dot" />
            <span className="dn-fact-body">
              <b>No score was generated.</b> <span>There is no number, no ranking, no grade.</span>
            </span>
          </div>
          <div className="dn-fact">
            <span className="dn-fact-dot" />
            <span className="dn-fact-body">
              <b>A person decides.</b> <span>Two named engineers read your work and reply within a week.</span>
            </span>
          </div>
          <div className="dn-fact">
            <span className="dn-fact-dot" data-tone="capture" />
            <span className="dn-fact-body">
              <b>Capture has stopped.</b> <span>The room is no longer recording anything.</span>
            </span>
          </div>
        </div>

        <p
          className="dn-retention"
          data-paper-region="retention"
          data-paper-label="Retention line"
          data-paper-role="evidence"
          data-paper-note="One honest mono line — same rules as everything else."
        >
          Kept for 30 days, then deleted. Ask us to delete it sooner, anytime.
        </p>

        <button
          type="button"
          className="dn-close"
          data-paper-region="close"
          data-paper-label="Close"
          data-paper-role="control"
        >
          Close the room
        </button>
      </div>
    </div>
  );
}
