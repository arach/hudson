/**
 * Producer · Compile — sanitize, assemble, declare, provision, validate.
 *
 * The candidate never sees the compiler — only the prepared room.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.pc-root {
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
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --sans: "Inter", "Inter Tight", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;

  position: absolute;
  inset: 0;
  overflow: auto;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}
.pc-wrap {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px 72px;
}
.pc-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.pc-title {
  font-family: var(--serif);
  font-size: 36px;
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin: 12px 0 0;
}
.pc-lede {
  font-size: 16px;
  line-height: 1.55;
  color: var(--soft);
  margin: 12px 0 0;
  max-width: 56ch;
}

.pc-pipeline {
  margin-top: 32px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 800px) {
  .pc-pipeline { grid-template-columns: repeat(2, 1fr); }
}
.pc-step {
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 16px 14px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
}
.pc-step-n {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  letter-spacing: 0.06em;
}
.pc-step-t {
  font-size: 15px;
  font-weight: 600;
  margin-top: 10px;
}
.pc-step-d {
  font-size: 12px;
  line-height: 1.4;
  color: var(--soft);
  margin-top: 6px;
  flex: 1;
}
.pc-step-s {
  margin-top: 12px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--proof-pass);
}

.pc-split {
  margin-top: 24px;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 14px;
}
@media (max-width: 800px) {
  .pc-split { grid-template-columns: 1fr; }
}

.pc-card {
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 18px;
}
.pc-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 14px;
}
.pc-checks {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}
.pc-checks li {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 10px;
  align-items: start;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ink);
}
.pc-check {
  width: 18px; height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--proof-pass) 16%, transparent);
  color: var(--proof-pass);
  margin-top: 1px;
}

.pc-console {
  background: var(--instr);
  color: var(--instr-ink);
  border-radius: 12px;
  padding: 16px 18px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.65;
  min-height: 180px;
}
.pc-console .dim { color: var(--instr-faint); }
.pc-console .ok { color: #8ab4a0; }

[data-flow-region][data-flow-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

const STEPS = [
  ["Sanitize", "Strip secrets, PII, live credentials"],
  ["Assemble", "Brief, materials, workspace layout"],
  ["Policy", "Tools, AI, capture, retention"],
  ["Provision", "Resettable workspace root"],
  ["Validate", "Gate checks before mint"],
] as const;

const CHECK = (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M2 5.2 4.2 7.2 8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ProducerCompile() {
  return (
    <div className="pc-root">
      <style>{CSS}</style>
      <div className="pc-wrap">
        <div className="pc-eyebrow">Producer · Compile</div>
        <h1
          className="pc-title"
          data-flow-region="title"
          data-flow-label="Title"
          data-flow-role="title"
        >
          Compile the room.
        </h1>
        <p className="pc-lede">
          Sanitize context, provision workspace, declare tools and capture,
          define reset boundaries. The candidate never sees your compiler —
          only the room.
        </p>

        <section
          className="pc-pipeline"
          data-flow-region="pipeline"
          data-flow-label="Compile pipeline"
          data-flow-role="section"
        >
          {STEPS.map(([t, d], i) => (
            <div key={t} className="pc-step">
              <div className="pc-step-n">{String(i + 1).padStart(2, "0")}</div>
              <div className="pc-step-t">{t}</div>
              <div className="pc-step-d">{d}</div>
              <div className="pc-step-s">ready</div>
            </div>
          ))}
        </section>

        <div className="pc-split">
          <section
            className="pc-card"
            data-flow-region="checks"
            data-flow-label="Gate checks"
            data-flow-role="section"
          >
            <div className="pc-label">Gate checks</div>
            <ul className="pc-checks">
              <li>
                <span className="pc-check">{CHECK}</span>
                No production credentials in workspace
              </li>
              <li>
                <span className="pc-check">{CHECK}</span>
                Scenario is synthetic or expired
              </li>
              <li>
                <span className="pc-check">{CHECK}</span>
                Rubric transparent · no score fields in candidate view
              </li>
              <li>
                <span className="pc-check">{CHECK}</span>
                Capture policy fingerprint stable for consent
              </li>
            </ul>
          </section>

          <section
            className="pc-console"
            data-flow-region="console"
            data-flow-label="Compiler log"
            data-flow-role="evidence"
            data-flow-note="Mono = proof / system output."
          >
            <div className="dim">$ fieldwork compile eng-01-v2</div>
            <div className="ok">✓ sanitize · 0 secrets remaining</div>
            <div className="ok">✓ assemble · 6 materials · brief.md</div>
            <div className="ok">✓ policy · sha 3f9a1c07…c2148d</div>
            <div className="ok">✓ provision · workspace/ eng-01-v2</div>
            <div className="ok">✓ validate · 4 / 4 gates</div>
            <div className="dim" style={{ marginTop: 10 }}>
              ready to mint · no candidate surface yet
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
