/**
 * Producer · Mint session — concierge mints a candidate-safe session.
 *
 * One session id, one role-world revision, one capture policy fingerprint.
 * Clock does not start until the candidate acknowledges.
 *
 * Sketch — self-contained tokens + type.
 */

const CSS = `
.pm-root {
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
.pm-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 28px 80px;
}
.pm-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.pm-title {
  font-family: var(--serif);
  font-size: 36px;
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin: 14px 0 0;
}
.pm-lede {
  font-size: 16px;
  line-height: 1.55;
  color: var(--soft);
  margin: 14px 0 0;
  max-width: 52ch;
}

.pm-ledger {
  margin-top: 32px;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  overflow: hidden;
}
.pm-ledger-head {
  padding: 12px 18px;
  background: var(--sunken);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  border-bottom: 1px solid var(--hairline);
}
.pm-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid var(--hairline);
  font-size: 14px;
  align-items: baseline;
}
.pm-row:first-of-type { border-top: none; }
.pm-k {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--faint);
}
.pm-v {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
  word-break: break-all;
}
.pm-v span { color: var(--soft); }

.pm-channels {
  margin-top: 28px;
}
.pm-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 12px;
}
.pm-ch-grid {
  display: grid;
  gap: 8px;
}
.pm-ch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 10px;
}
.pm-ch-name {
  font-size: 14px;
  font-weight: 500;
}
.pm-ch-meta {
  font-size: 12px;
  color: var(--soft);
  margin-top: 2px;
}
.pm-ch-status {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex: none;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
  color: var(--soft);
}
.pm-ch-status[data-on="true"] {
  color: var(--capture);
  border-color: color-mix(in srgb, var(--capture) 40%, transparent);
  background: color-mix(in srgb, var(--capture) 8%, transparent);
}
.pm-ch-status[data-opt="true"] {
  color: var(--faint);
}

.pm-actions {
  margin-top: 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pm-btn {
  appearance: none;
  border: none;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  padding: 12px 20px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--raised);
  cursor: default;
}
.pm-btn[data-tone="quiet"] {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--edge);
}
.pm-note {
  margin-top: 16px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--faint);
}

[data-flow-region][data-flow-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

export function ProducerMint() {
  return (
    <div className="pm-root">
      <style>{CSS}</style>
      <div className="pm-wrap">
        <div className="pm-eyebrow">Producer · Mint session</div>
        <h1
          className="pm-title"
          data-flow-region="title"
          data-flow-label="Title"
          data-flow-role="title"
        >
          Mint a candidate-safe session.
        </h1>
        <p className="pm-lede">
          One session id, one role world revision, one capture policy
          fingerprint. The clock does not start until the candidate
          acknowledges.
        </p>

        <section
          className="pm-ledger"
          data-flow-region="ledger"
          data-flow-label="Session ledger"
          data-flow-role="ledger"
          data-flow-note="Mono evidence chain — session draft before start."
        >
          <div className="pm-ledger-head">Session draft</div>
          <div className="pm-row">
            <span className="pm-k">session</span>
            <span className="pm-v">FW-DEV-eng-01-v2</span>
          </div>
          <div className="pm-row">
            <span className="pm-k">role world</span>
            <span className="pm-v">
              eng-01-v2 <span>· rev 4</span>
            </span>
          </div>
          <div className="pm-row">
            <span className="pm-k">timebox</span>
            <span className="pm-v">
              75:00 <span>· not started</span>
            </span>
          </div>
          <div className="pm-row">
            <span className="pm-k">policy</span>
            <span className="pm-v">sha 3f9a1c07…c2148d</span>
          </div>
          <div className="pm-row">
            <span className="pm-k">candidate</span>
            <span className="pm-v">
              entry ticket ready <span>· cookie on land</span>
            </span>
          </div>
        </section>

        <section
          className="pm-channels"
          data-flow-region="channels"
          data-flow-label="Capture channels"
          data-flow-role="section"
        >
          <div className="pm-label">Capture (declared)</div>
          <div className="pm-ch-grid">
            <div className="pm-ch">
              <div>
                <div className="pm-ch-name">Workspace events</div>
                <div className="pm-ch-meta">File, command, AI — server-authored</div>
              </div>
              <span className="pm-ch-status" data-on="true">
                required
              </span>
            </div>
            <div className="pm-ch">
              <div>
                <div className="pm-ch-name">Screen</div>
                <div className="pm-ch-meta">While running · external recorder</div>
              </div>
              <span className="pm-ch-status" data-on="true">
                required
              </span>
            </div>
            <div className="pm-ch">
              <div>
                <div className="pm-ch-name">Microphone</div>
                <div className="pm-ch-meta">Declining changes nothing else</div>
              </div>
              <span className="pm-ch-status" data-opt="true">
                optional
              </span>
            </div>
          </div>
        </section>

        <div
          className="pm-actions"
          data-flow-region="actions"
          data-flow-label="Actions"
          data-flow-role="control"
        >
          <button type="button" className="pm-btn">
            Mint &amp; open room
          </button>
          <button type="button" className="pm-btn" data-tone="quiet">
            Copy entry link
          </button>
        </div>
        <p className="pm-note">
          never captured · face · voice analysis · keystroke biometrics ·
          personality
        </p>
      </div>
    </div>
  );
}
