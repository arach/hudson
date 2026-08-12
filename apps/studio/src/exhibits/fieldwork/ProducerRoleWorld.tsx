/**
 * Producer · Role world — expired work → bounded world.
 *
 * Hiring team prepares inputs; compiler later sanitizes. This stage is about
 * intent and source — not minting yet.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.pr-root {
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
  overflow: auto;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}
.pr-wrap {
  max-width: 880px;
  margin: 0 auto;
  padding: 48px 28px 80px;
}
.pr-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.pr-title {
  font-family: var(--serif);
  font-size: 36px;
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin: 14px 0 0;
}
.pr-lede {
  font-size: 16px;
  line-height: 1.55;
  color: var(--soft);
  margin: 14px 0 0;
  max-width: 54ch;
}

.pr-grid {
  margin-top: 36px;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
}
@media (max-width: 720px) {
  .pr-grid { grid-template-columns: 1fr; }
}

.pr-card {
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 20px;
}
.pr-card-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 14px;
}
.pr-source {
  display: grid;
  gap: 12px;
}
.pr-source-row {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: start;
}
.pr-num {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--sunken);
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
}
.pr-source-row b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}
.pr-source-row span {
  font-size: 13px;
  line-height: 1.45;
  color: var(--soft);
}

.pr-out-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
.pr-out-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--ink);
}
.pr-out-list li::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--proof-pass);
  flex: none;
}

.pr-banner {
  margin-top: 16px;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 18px 20px;
  background: var(--sunken);
  border-radius: 12px;
  border: 1px solid var(--hairline);
}
.pr-banner p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--soft);
  max-width: 48ch;
}
.pr-banner strong { color: var(--ink); font-weight: 600; }
.pr-btn {
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
  flex: none;
}

.pr-meta {
  margin-top: 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pr-pill {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
  color: var(--soft);
  background: var(--raised);
}

[data-flow-region][data-flow-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

export function ProducerRoleWorld() {
  return (
    <div className="pr-root">
      <style>{CSS}</style>
      <div className="pr-wrap">
        <div className="pr-eyebrow">Producer · Role world</div>
        <h1
          className="pr-title"
          data-flow-region="title"
          data-flow-label="Title"
          data-flow-role="title"
        >
          Turn expired work into a bounded world.
        </h1>
        <p className="pr-lede">
          Compile a realistic brief, tools, and capture policy from something
          the company already understands — without leaking production secrets
          or creating unpaid work.
        </p>

        <div className="pr-grid">
          <section
            className="pr-card"
            data-flow-region="inputs"
            data-flow-label="Inputs"
            data-flow-role="section"
          >
            <div className="pr-card-label">Inputs</div>
            <div className="pr-source">
              <div className="pr-source-row">
                <span className="pr-num">01</span>
                <div>
                  <b>Resolved incident or expired ticket</b>
                  <span>
                    Something the team already closed — never live production
                    work.
                  </span>
                </div>
              </div>
              <div className="pr-source-row">
                <span className="pr-num">02</span>
                <div>
                  <b>Role intent — engineer or builder</b>
                  <span>
                    Which craft this session should surface evidence for.
                  </span>
                </div>
              </div>
              <div className="pr-source-row">
                <span className="pr-num">03</span>
                <div>
                  <b>Evidence this session should create</b>
                  <span>
                    Frame · Make · Verify · Hand off — not a personality score.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section
            className="pr-card"
            data-flow-region="outputs"
            data-flow-label="Outputs"
            data-flow-role="section"
          >
            <div className="pr-card-label">What leaves this stage</div>
            <ul className="pr-out-list">
              <li>Outcome &amp; 75-minute timebox</li>
              <li>Sanitized materials</li>
              <li>Tool policy · declared AI</li>
              <li>Capture ledger</li>
              <li>Transparent rubric</li>
            </ul>
          </section>

          <div
            className="pr-banner"
            data-flow-region="next"
            data-flow-label="Next step"
            data-flow-role="control"
          >
            <p>
              <strong>Ready when the source is honest.</strong> Next: mint a
              candidate-safe session from this role world revision.
            </p>
            <button type="button" className="pr-btn">
              Continue to mint
            </button>
          </div>
        </div>

        <div className="pr-meta">
          <span className="pr-pill">eng-01-v2 draft</span>
          <span className="pr-pill">synthetic / expired only</span>
          <span className="pr-pill">no unpaid production</span>
        </div>
      </div>
    </div>
  );
}
