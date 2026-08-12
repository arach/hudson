/** Review · Calibrate — side-by-side readings without score averaging. */

import { SurfaceShell, regionProps } from "./SurfaceShell";

const CSS = `
.rc-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 28px;
  align-items: end;
}
.rc-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: 1px solid color-mix(in srgb, var(--pause) 50%, var(--hairline));
  border-radius: 999px;
  color: #7e5b1e;
  background: color-mix(in srgb, var(--pause) 8%, var(--raised));
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rc-status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--pause); }
.rc-moment {
  margin-top: 30px;
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 180px;
  gap: 20px;
  align-items: center;
  padding: 19px 20px;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 10px;
}
.rc-moment-time { color: var(--faint); font-family: var(--mono); font-size: 11px; }
.rc-moment-quote { font-family: var(--serif); font-size: 18px; line-height: 1.4; }
.rc-moment-source { color: var(--capture); font-family: var(--mono); font-size: 10px; text-align: right; }
.rc-reviewers {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  margin-top: 28px;
}
.rc-reviewers::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--edge);
  transform: translateX(-0.5px);
}
.rc-review { min-width: 0; padding: 4px 22px 8px; }
.rc-review:first-child { padding-left: 0; }
.rc-review:last-child { padding-right: 0; }
.rc-reviewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--hairline);
}
.rc-person { display: flex; align-items: center; gap: 10px; }
.rc-avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--sunken);
  color: var(--soft);
  font-family: var(--mono);
  font-size: 10px;
}
.rc-person strong { display: block; font-size: 13px; }
.rc-person span { display: block; margin-top: 2px; color: var(--faint); font-family: var(--mono); font-size: 9px; }
.rc-reading {
  color: var(--soft);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.rc-note-block { margin-top: 23px; }
.rc-note-block h3 {
  margin: 0 0 9px;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.rc-note-block p { margin: 0; color: var(--soft); font-size: 14px; line-height: 1.65; }
.rc-evidence {
  display: inline-flex;
  margin-top: 10px;
  color: var(--capture);
  font-family: var(--mono);
  font-size: 10px;
  text-decoration: none;
}
.rc-question {
  margin-top: 32px;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) auto;
  gap: 22px;
  align-items: center;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--pause) 45%, var(--hairline));
  border-radius: 10px;
  background: color-mix(in srgb, var(--pause) 7%, var(--raised));
}
.rc-question-label { color: #7e5b1e; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
.rc-question p { margin: 0; font-family: var(--serif); font-size: 17px; line-height: 1.4; }
.rc-question-state { color: var(--soft); font-family: var(--mono); font-size: 10px; white-space: nowrap; }
.rc-principle {
  margin-top: 18px;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
}

@media (max-width: 760px) {
  .rc-header, .rc-moment, .rc-reviewers, .rc-question { grid-template-columns: 1fr; }
  .rc-status { margin-top: 18px; width: fit-content; }
  .rc-moment-source { text-align: left; }
  .rc-reviewers::before { display: none; }
  .rc-review { padding: 24px 0; border-bottom: 1px solid var(--edge); }
}
`;

export function ReviewCalibrate() {
  return (
    <SurfaceShell wide>
      <style>{CSS}</style>
      <header className="rc-header" {...regionProps("header", "Calibration header", "header")}>
        <div>
          <div className="fw-eyebrow">Review · Calibrate</div>
          <h1 className="fw-title">Compare readings, not scores.</h1>
          <p className="fw-lede">Two reviewers read the same moment. Their disagreement remains explicit until the underlying question is resolved.</p>
        </div>
        <div className="rc-status">disagreement visible</div>
      </header>

      <section className="rc-moment" {...regionProps("shared-moment", "Shared work-tape moment", "evidence")}>
        <div className="rc-moment-time">00:39:16 · evt-0337</div>
        <div className="rc-moment-quote">“First check passed, but did not exercise the stale-entry path.”</div>
        <a className="rc-moment-source" href="/embed/review-source#evt-0337">↗ open captured source</a>
      </section>

      <div className="rc-reviewers">
        <article className="rc-review" {...regionProps("reviewer-one", "Mara's reading", "review")}>
          <div className="rc-reviewer-head">
            <div className="rc-person"><div className="rc-avatar">MR</div><div><strong>Mara R.</strong><span>engineering reviewer</span></div></div>
            <div className="rc-reading">promising signal</div>
          </div>
          <div className="rc-note-block">
            <h3>Reading</h3>
            <p>The candidate identified the gap without prompting and followed it into the patch. I read this as active verification, even though the first test was incomplete.</p>
            <a className="rc-evidence" href="/embed/review-source#evt-0338">↗ events 0338–0343</a>
          </div>
          <div className="rc-note-block">
            <h3>What would change my reading</h3>
            <p>Evidence that the deletion path was noticed only after the session, rather than during the work.</p>
          </div>
        </article>

        <article className="rc-review" {...regionProps("reviewer-two", "Noah's reading", "review")}>
          <div className="rc-reviewer-head">
            <div className="rc-person"><div className="rc-avatar">NK</div><div><strong>Noah K.</strong><span>engineering reviewer</span></div></div>
            <div className="rc-reading">material concern</div>
          </div>
          <div className="rc-note-block">
            <h3>Reading</h3>
            <p>The patch handles deletion, but the candidate described the check as sufficient before that behavior was isolated. I read this as a verification-depth concern.</p>
            <a className="rc-evidence" href="/embed/review-source#evt-0331">↗ events 0331–0337</a>
          </div>
          <div className="rc-note-block">
            <h3>What would change my reading</h3>
            <p>A later captured run that directly asserts deletion, or a handoff note naming the remaining uncertainty.</p>
          </div>
        </article>
      </div>

      <section className="rc-question" {...regionProps("open-question", "Open calibration question", "decision")}>
        <div className="rc-question-label">Resolve the interpretation</div>
        <p>Does noticing and repairing the gap during the session answer the concern, or is the missing direct check still material?</p>
        <div className="rc-question-state">open · needs source review</div>
      </section>

      <footer className="rc-principle" {...regionProps("principle", "Calibration principle", "footer")}>
        Keep both notes attached to the moment · do not average · revise only with source-linked evidence
      </footer>
    </SurfaceShell>
  );
}
