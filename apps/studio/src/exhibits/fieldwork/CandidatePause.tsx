/**
 * Candidate · Pause — the room goes quiet, the work is safe.
 *
 * Direction §11: the entire instrument desaturates and goes non-interactive,
 * visibly preserving the work beneath. A full-width band in --pause (the only
 * place amber appears) says the clock is stopped — this is the room, not your
 * work, and it won't count against you. Clock freezes; capture visibly holds.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.pz-root {
  --room: #ece9e2;
  --raised: #f8f6f1;
  --ink: #211f1c;
  --soft: #5b5952;
  --faint: #8c897f;
  --hairline: rgba(33, 31, 28, 0.10);
  --edge: rgba(33, 31, 28, 0.16);
  --capture: #5a7d86;
  --pause: #c08a2e;
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

.pz-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--raised);
  border-bottom: 1px solid var(--hairline);
}
.pz-id { display: flex; align-items: baseline; gap: 12px; }
.pz-role {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.pz-title { font-family: var(--serif); font-size: 16px; color: var(--ink); }
.pz-status { display: flex; align-items: center; gap: 14px; }
/* Clock frozen + capture held — visibly stopped together, in mono. */
.pz-frozen {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pause);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.pz-held {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.pz-held-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--capture); opacity: 0.5; }

/* Full-width amber band — the only place amber appears. */
.pz-band {
  flex: none;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  background: color-mix(in srgb, var(--pause) 14%, var(--room));
  border-bottom: 1px solid color-mix(in srgb, var(--pause) 40%, transparent);
}
.pz-band-mark {
  flex: none;
  width: 34px; height: 34px;
  border-radius: 8px;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--pause) 22%, transparent);
  color: var(--pause);
}
.pz-band-copy { flex: 1; min-width: 0; }
.pz-band-lead {
  font-family: var(--serif);
  font-size: 18px;
  color: color-mix(in srgb, var(--pause) 55%, var(--ink));
}
.pz-band-sub { font-size: 14px; line-height: 1.5; color: var(--soft); margin-top: 3px; }
.pz-resume {
  flex: none;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--raised);
  background: var(--ink);
  border: none;
  border-radius: 8px;
  padding: 11px 22px;
  cursor: default;
}

/* Dimmed instrument beneath — preserved, non-interactive. */
.pz-instr {
  flex: 1;
  min-height: 0;
  margin: 0;
  background: var(--instr);
  color: var(--instr-ink);
  display: flex;
  flex-direction: column;
  filter: saturate(0.6);
  opacity: 0.5;
  position: relative;
}
.pz-instr::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(20, 21, 24, 0.35);
  pointer-events: none;
}
.pz-tabs {
  flex: none;
  display: flex;
  background: var(--instr-raised);
  border-bottom: 1px solid var(--instr-line);
}
.pz-tab {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--instr-faint);
  padding: 12px 16px;
  border-right: 1px solid var(--instr-line);
}
.pz-tab[data-active="true"] { color: var(--instr-ink); background: var(--instr); }
.pz-editor {
  flex: 1;
  overflow: hidden;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  padding: 16px 0;
}
.pz-line { display: grid; grid-template-columns: 44px 1fr; }
.pz-gutter { text-align: right; padding-right: 16px; color: var(--instr-faint); opacity: 0.6; }
.pz-code { color: var(--instr-ink); white-space: pre; opacity: 0.85; }

[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: -2px;
  border-radius: 4px;
}
`;

const PAUSE_GLYPH = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor" />
    <rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor" />
  </svg>
);

const FROZEN_LINES = [
  "export function isEligible(claim) {",
  '  if (claim.status === "unknown") {',
  "    return requiresReview(claim);",
  "  }",
  "  return claim.amount <= 500;",
  "}",
];

export function CandidatePause() {
  return (
    <div className="pz-root">
      <style>{CSS}</style>

      <header
        className="pz-header"
        data-paper-region="header"
        data-paper-label="Header (frozen)"
        data-paper-role="header"
        data-paper-note="Clock frozen + capture held — visibly stopped together."
      >
        <div className="pz-id">
          <span className="pz-role">Engineer</span>
          <span className="pz-title">Make the decision boundary honest.</span>
        </div>
        <div className="pz-status">
          <span className="pz-frozen">Clock frozen</span>
          <span className="pz-held">
            <span className="pz-held-dot" />
            Capture held
          </span>
        </div>
      </header>

      <div
        className="pz-band"
        data-paper-region="band"
        data-paper-label="Pause band"
        data-paper-role="signal"
        data-paper-note="Full-width amber — the only place --pause appears."
      >
        <span className="pz-band-mark">{PAUSE_GLYPH}</span>
        <div className="pz-band-copy">
          <div className="pz-band-lead">Technical pause — your clock is stopped.</div>
          <div className="pz-band-sub">
            This is the room, not your work, and it won't count against you.
            Your work returns exactly as you left it.
          </div>
        </div>
        <button
          type="button"
          className="pz-resume"
          data-paper-region="resume"
          data-paper-label="Resume"
          data-paper-role="control"
          data-paper-note="One calm action — no countdown, no anxiety."
        >
          Resume
        </button>
      </div>

      <main
        className="pz-instr"
        data-paper-region="instrument"
        data-paper-label="Dimmed instrument"
        data-paper-role="instrument"
        data-paper-note="Desaturated + non-interactive — the work preserved beneath."
      >
        <div className="pz-tabs">
          <span className="pz-tab" data-active="true">eligibility.ts</span>
          <span className="pz-tab">eligibility.test.ts</span>
          <span className="pz-tab">Terminal</span>
        </div>
        <div className="pz-editor">
          {FROZEN_LINES.map((line, i) => (
            <div key={i} className="pz-line">
              <span className="pz-gutter">{42 + i}</span>
              <span className="pz-code">{line}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
