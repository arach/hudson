/**
 * Candidate · Orientation — the prepared desk.
 *
 * A first-class Studio design page. This is the *real* design (content); the
 * Paper journey card embeds this exact surface via an <iframe> to
 * `/embed/candidate-orientation` (see EmbedPage + the Paper `Embed` primitive).
 *
 * Faithful to fieldwork/docs/candidate-experience-direction.md §5:
 *   quiet · exact · trustworthy · serious — a well-set desk, not a ToS wall.
 *   Top-to-bottom story (never an equal-weight card grid). One centered column.
 *   Capture is the calmest color in the room. Start is calm ink, never a glow.
 *
 * Self-contained: owns its tokens, type, and motion so it renders identically
 * standalone (in the Paper card iframe) and inside Studio.
 */

import { useId, useState } from "react";

const CSS = `
.co-root {
  /* §3 — the room, cooled + low chroma */
  --room: #ece9e2;
  --raised: #f8f6f1;
  --sunken: #e5e1d8;
  --ink: #211f1c;
  --soft: #5b5952;
  --faint: #8c897f;
  --hairline: rgba(33, 31, 28, 0.10);
  --edge: rgba(33, 31, 28, 0.16);
  /* signals — each owns exactly one meaning */
  --capture: #5a7d86;   /* you are being recorded — calm slate-teal */
  --voice: #b0512f;     /* a human is speaking */

  --serif: "Newsreader", "Iowan Old Style", "Fraunces", Georgia, serif;
  --sans: "Inter", "Inter Tight", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", "Berkeley Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.co-column {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 88px 32px 128px;
  animation: co-settle 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@keyframes co-settle {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.co-eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--faint);
}

.co-title {
  font-family: var(--serif);
  font-size: 56px;
  line-height: 1.02;
  font-weight: 500;
  letter-spacing: -0.015em;
  color: var(--ink);
  margin: 20px 0 0;
}

.co-outcome {
  font-size: 18px;
  line-height: 1.55;
  color: var(--soft);
  margin: 20px 0 0;
  max-width: 60ch;
}

/* Section rhythm — generous vertical space, a hairline lead, a mono label. */
.co-section { margin-top: 56px; }
.co-label {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--faint);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--hairline);
  margin-bottom: 20px;
}

.co-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.co-item { display: flex; gap: 14px; align-items: baseline; }
.co-tick {
  flex: none;
  width: 6px; height: 6px; margin-top: 8px;
  border-radius: 50%;
  background: var(--ink);
  opacity: 0.35;
}
.co-item-body { font-size: 15px; line-height: 1.5; color: var(--ink); }
.co-item-note { color: var(--soft); }

/* §5.5 — AI, blessed. Load-bearing paragraph, quietly set apart. */
.co-ai {
  margin-top: 20px;
  padding: 20px 22px;
  border-radius: 10px;
  background: var(--raised);
  border: 1px solid var(--hairline);
}
.co-ai-head { display: flex; align-items: center; gap: 10px; }
.co-ai-model {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--ink);
}
.co-ai-allowed {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--soft);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--edge);
}
.co-ai-body { font-size: 15px; line-height: 1.55; color: var(--soft); margin: 12px 0 0; }
.co-ai-body strong { color: var(--ink); font-weight: 600; }

/* §5.6 + §10 — the capture ledger. Sunken, calm, --capture appears here first. */
.co-ledger {
  margin-top: 20px;
  background: var(--sunken);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 24px 26px;
}
.co-ledger-lead { font-size: 14px; line-height: 1.55; color: var(--soft); margin: 0 0 20px; }
.co-channels { display: flex; flex-direction: column; gap: 0; }
.co-channel {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 0;
  border-top: 1px solid var(--hairline);
}
.co-channel:first-child { border-top: none; padding-top: 0; }
.co-dot {
  flex: none; width: 9px; height: 9px; margin-top: 5px; border-radius: 50%;
}
.co-dot--on { background: var(--capture); }
.co-dot--off { background: transparent; border: 1px solid var(--faint); }
.co-channel-main { flex: 1; min-width: 0; }
.co-channel-name { font-size: 15px; font-weight: 500; color: var(--ink); }
.co-channel-desc { font-size: 13px; line-height: 1.5; color: var(--soft); margin-top: 2px; }
.co-channel-state {
  flex: none;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding-top: 2px;
}
.co-channel-state--on { color: var(--capture); }
.co-channel-state--off { color: var(--faint); }

.co-ledger-facts {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--hairline);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 28px;
}
.co-fact-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--faint);
}
.co-fact-value { font-size: 13px; line-height: 1.5; color: var(--ink); margin-top: 4px; }
.co-never { grid-column: 1 / -1; }
.co-never .co-fact-value { color: var(--soft); }

/* §5.7 — acknowledgement, candidate-authored. Graphite, not accent. */
.co-ack {
  margin-top: 32px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  cursor: pointer;
  user-select: none;
}
.co-check {
  flex: none;
  width: 20px; height: 20px; margin-top: 1px;
  border-radius: 5px;
  border: 1.5px solid var(--edge);
  background: var(--raised);
  display: grid; place-items: center;
  transition: border-color 120ms cubic-bezier(0.2, 0.7, 0.2, 1),
              background 120ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.co-check[data-checked="true"] { border-color: var(--ink); background: var(--ink); }
.co-check svg { opacity: 0; transition: opacity 120ms; }
.co-check[data-checked="true"] svg { opacity: 1; }
.co-ack-text { font-size: 15px; line-height: 1.45; color: var(--ink); }
.co-ack-text span { display: block; font-size: 13px; color: var(--soft); margin-top: 3px; }

.co-fingerprint {
  margin-top: 16px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--faint);
}
.co-fingerprint b { color: var(--soft); font-weight: 500; }

/* §5.8 — Start. Calm ink, no glow. Gravity is in the moment, not the button. */
.co-start-row { margin-top: 40px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.co-start {
  appearance: none;
  border: none;
  font-family: var(--sans);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--raised);
  background: var(--ink);
  padding: 14px 28px;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 120ms, transform 120ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.co-start:disabled { opacity: 0.32; cursor: not-allowed; }
.co-start:not(:disabled):hover { transform: translateY(-1px); }
.co-start-note { font-size: 13px; line-height: 1.5; color: var(--faint); max-width: 40ch; }

/* Paper inspect — region outline when selected on the map (data-paper-selected). */
[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
[data-paper-embed="live"][data-inspect="on"] [data-paper-region] {
  cursor: crosshair;
}
[data-paper-embed="live"][data-inspect="on"] [data-paper-region]:hover {
  outline: 1px dashed color-mix(in srgb, #5a7d86 45%, transparent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .co-column { animation: none; }
  .co-start:hover { transform: none; }
}
`;

const CHECK = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M2.5 6.2 4.8 8.5 9.5 3.5"
      stroke="#f8f6f1"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function CandidateOrientation() {
  const [acked, setAcked] = useState(false);
  const ackId = useId();

  return (
    <div className="co-root">
      <style>{CSS}</style>
      <div className="co-column">
        <div
          className="co-eyebrow"
          data-paper-region="eyebrow"
          data-paper-label="Eyebrow"
          data-paper-role="eyebrow"
          data-paper-note="Role · timebox identity line"
        >
          Engineer · 75-minute work session
        </div>
        <h1
          className="co-title"
          data-paper-region="title"
          data-paper-label="Title"
          data-paper-role="title"
          data-paper-note="Serif display — the job in plain language"
        >
          Make the decision boundary honest.
        </h1>
        <p
          className="co-outcome"
          data-paper-region="outcome"
          data-paper-label="Outcome"
          data-paper-role="body"
          data-paper-note="One-sentence outcome under the title"
        >
          Unknown eligibility is silently recommending refunds in production.
          Your job is to make the boundary honest again — decide what the code
          should do at the edges, and leave it safe for the next person.
        </p>

        <section
          className="co-section"
          data-paper-region="handoff"
          data-paper-label="What you'll hand off"
          data-paper-role="section"
          data-paper-note="Deliverables list"
        >
          <div className="co-label">What you'll hand off</div>
          <ul className="co-list">
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                A corrected eligibility check with the boundary cases made
                explicit.
              </span>
            </li>
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                Tests that pin the behavior you decided on — so the boundary
                can't quietly drift again.
              </span>
            </li>
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                A short note: what changed, what still carries risk, the next
                step you'd take.
              </span>
            </li>
          </ul>
        </section>

        <section
          className="co-section"
          data-paper-region="constraints"
          data-paper-label="What to hold true"
          data-paper-role="section"
          data-paper-note="Constraints / invariants"
        >
          <div className="co-label">What to hold true</div>
          <ul className="co-list">
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                The billing ledger is read-only. Read from it; never write to
                it.
              </span>
            </li>
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                Refunds over $500 stay behind manual review. That line does not
                move.
              </span>
            </li>
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                Ship behind the existing{" "}
                <code
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "13px",
                    color: "var(--soft)",
                  }}
                >
                  eligibility_v2
                </code>{" "}
                flag — nothing reaches everyone today.
              </span>
            </li>
          </ul>
        </section>

        <section
          className="co-section"
          data-paper-region="tools"
          data-paper-label="Your tools — including AI"
          data-paper-role="section"
          data-paper-note="Declared tools + AI blessing"
        >
          <div className="co-label">Your tools — including AI</div>
          <ul className="co-list">
            <li className="co-item">
              <span className="co-tick" />
              <span className="co-item-body">
                A real editor and terminal — the repository at a pinned commit,
                <span className="co-item-note"> with </span>
                <code
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "13px",
                    color: "var(--soft)",
                  }}
                >
                  bun test
                </code>
                <span className="co-item-note"> wired up.</span>
              </span>
            </li>
          </ul>
          <div className="co-ai">
            <div className="co-ai-head">
              <span className="co-ai-model">Declared tool · Claude</span>
              <span className="co-ai-allowed">allowed</span>
            </div>
            <p className="co-ai-body">
              Claude is available and allowed. <strong>Directing it well —
              and catching it when it's wrong — is part of the work</strong>,
              not a shortcut around it. Your prompts and its replies travel into
              your handoff exactly as they happened. No one grades how you use
              it.
            </p>
          </div>
        </section>

        <section
          className="co-section"
          data-paper-region="capture"
          data-paper-label="What this room records"
          data-paper-role="ledger"
          data-paper-note="Capture ledger — calm, sunken"
        >
          <div className="co-label">What this room records</div>
          <div className="co-ledger">
            <p className="co-ledger-lead">
              A record of the room, not a judgment of you. Same retention and
              deletion rules as everything else.
            </p>
            <div className="co-channels">
              <div className="co-channel">
                <span className="co-dot co-dot--on" />
                <div className="co-channel-main">
                  <div className="co-channel-name">Screen</div>
                  <div className="co-channel-desc">
                    The work surface, while the clock is running.
                  </div>
                </div>
                <div className="co-channel-state co-channel-state--on">On</div>
              </div>
              <div className="co-channel">
                <span className="co-dot co-dot--on" />
                <div className="co-channel-main">
                  <div className="co-channel-name">Terminal &amp; commands</div>
                  <div className="co-channel-desc">
                    What you run, and what it returns.
                  </div>
                </div>
                <div className="co-channel-state co-channel-state--on">On</div>
              </div>
              <div className="co-channel">
                <span className="co-dot co-dot--off" />
                <div className="co-channel-main">
                  <div className="co-channel-name">Microphone</div>
                  <div className="co-channel-desc">
                    Your choice. Declining changes nothing else about your
                    session.
                  </div>
                </div>
                <div className="co-channel-state co-channel-state--off">
                  Off
                </div>
              </div>
            </div>
            <div className="co-ledger-facts">
              <div>
                <div className="co-fact-label">Kept for</div>
                <div className="co-fact-value">30 days, then deleted.</div>
              </div>
              <div>
                <div className="co-fact-label">Reviewed by</div>
                <div className="co-fact-value">
                  Two named engineers on the hiring team.
                </div>
              </div>
              <div className="co-never">
                <div className="co-fact-label">Never captured</div>
                <div className="co-fact-value">
                  Your face, voice analysis, keystroke biometrics, personality.
                  None of it, ever.
                </div>
              </div>
            </div>
          </div>
        </section>

        <label
          className="co-ack"
          htmlFor={ackId}
          data-paper-region="ack"
          data-paper-label="Acknowledgement"
          data-paper-role="control"
          data-paper-note="Candidate-authored consent"
        >
          <span className="co-check" data-checked={acked}>
            {CHECK}
          </span>
          <input
            id={ackId}
            type="checkbox"
            checked={acked}
            onChange={(e) => setAcked(e.target.checked)}
            style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
          />
          <span className="co-ack-text">
            I've read how this room works, and I understand what's captured and
            what isn't.
            <span>I'm ready to start when I am.</span>
          </span>
        </label>

        <div
          className="co-fingerprint"
          data-paper-region="fingerprint"
          data-paper-label="Consent fingerprint"
          data-paper-role="evidence"
          data-paper-note="Mono receipt of authored consent"
        >
          <b>authored by you</b> · sha 3f9a1c07…c2148d · {new Date().getUTCFullYear()}
        </div>

        <div
          className="co-start-row"
          data-paper-region="start"
          data-paper-label="Start work"
          data-paper-role="control"
          data-paper-note="Calm ink CTA — disabled until ack"
        >
          <button className="co-start" type="button" disabled={!acked}>
            Start work
          </button>
          <span className="co-start-note">
            Your 75 minutes begin when you start. The clock is yours to pause.
          </span>
        </div>
      </div>
    </div>
  );
}
