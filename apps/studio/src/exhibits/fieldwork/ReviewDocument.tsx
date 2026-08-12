/** Review · Document — artifact and candidate handoff sketch. */

import { useState } from "react";
import { SurfaceShell, regionProps } from "./SurfaceShell";

const CSS = `
.rd-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.rd-stamp {
  padding: 7px 10px;
  border: 1px solid var(--edge);
  border-radius: 4px;
  color: var(--soft);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  transform: rotate(-1deg);
}
.rd-workspace {
  margin-top: 34px;
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(33, 31, 28, 0.06);
}
.rd-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 16px;
  background: var(--sunken);
  border-bottom: 1px solid var(--hairline);
}
.rd-tab {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--faint);
  padding: 14px 14px 12px;
  font-family: var(--mono);
  font-size: 11px;
}
.rd-tab[data-active="true"] {
  border-bottom-color: var(--capture);
  color: var(--ink);
}
.rd-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  min-height: 500px;
}
.rd-document { padding: 44px 48px 56px; }
.rd-document h2 {
  margin: 0;
  font-family: var(--serif);
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.015em;
}
.rd-byline {
  margin-top: 9px;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 10px;
}
.rd-block {
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid var(--hairline);
}
.rd-block h3 {
  margin: 0 0 10px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--faint);
}
.rd-block p, .rd-block li {
  color: var(--soft);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.65;
}
.rd-block p { margin: 0; }
.rd-block ul { margin: 0; padding-left: 20px; }
.rd-inline-code {
  border-radius: 4px;
  background: var(--sunken);
  padding: 2px 5px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink);
}
.rd-margin {
  padding: 30px 22px;
  background: color-mix(in srgb, var(--sunken) 72%, var(--raised));
  border-left: 1px solid var(--hairline);
}
.rd-note {
  padding: 16px 0;
  border-top: 1px solid var(--hairline);
}
.rd-note:first-of-type { border-top: 0; padding-top: 8px; }
.rd-note-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faint);
}
.rd-note p { margin: 7px 0 0; color: var(--soft); font-size: 12px; line-height: 1.55; }
.rd-note a { color: var(--capture); text-decoration: none; font-family: var(--mono); font-size: 10px; }
.rd-provenance {
  margin-top: 18px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.5;
}

@media (max-width: 760px) {
  .rd-body { grid-template-columns: 1fr; }
  .rd-document { padding: 32px 24px 40px; }
  .rd-margin { border-left: 0; border-top: 1px solid var(--hairline); }
  .rd-provenance { display: block; }
}
`;

export function ReviewDocument() {
  const [tab, setTab] = useState<"artifact" | "handoff">("handoff");

  return (
    <SurfaceShell wide>
      <style>{CSS}</style>
      <header {...regionProps("header", "Document header", "header")}>
        <div className="rd-topline">
          <div className="fw-eyebrow">Review · Document</div>
          <div className="rd-stamp">candidate-authored · sealed</div>
        </div>
        <h1 className="fw-title">Read the work in its own words.</h1>
        <p className="fw-lede">
          The submitted artifact and handoff are preserved together. Reviewer
          notes live in the margin, not inside the candidate’s document.
        </p>
      </header>

      <section className="rd-workspace" {...regionProps("document", "Artifact document", "document")}>
        <nav className="rd-tabs" aria-label="Document tabs">
          <button type="button" className="rd-tab" data-active={tab === "artifact"} onClick={() => setTab("artifact")}>
            cache.ts · artifact
          </button>
          <button type="button" className="rd-tab" data-active={tab === "handoff"} onClick={() => setTab("handoff")}>
            HANDOFF.md · candidate handoff
          </button>
        </nav>

        <div className="rd-body">
          <article className="rd-document">
            {tab === "handoff" ? (
              <>
                <h2>Cache invalidation handoff</h2>
                <div className="rd-byline">submitted at 01:03:12 · revision 4f21c9a</div>
                <div className="rd-block">
                  <h3>What I changed</h3>
                  <p>
                    I moved expiry evaluation into <span className="rd-inline-code">readEntry</span> so
                    callers cannot accidentally serve stale values. I kept the storage format unchanged.
                  </p>
                </div>
                <div className="rd-block">
                  <h3>How I checked it</h3>
                  <ul>
                    <li>Reproduced the original miss with the provided fixture.</li>
                    <li>Added a regression check for an entry at the expiry boundary.</li>
                    <li>Ran the focused cache suite and the existing unit suite.</li>
                  </ul>
                </div>
                <div className="rd-block">
                  <h3>What I would do next</h3>
                  <p>
                    Exercise concurrent refreshes and add visibility for repeated misses. I would also
                    confirm the clock behavior in the production runtime before release.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2>readEntry expiry patch</h2>
                <div className="rd-byline">src/cache.ts · revision 4f21c9a</div>
                <div className="rd-block">
                  <h3>Patch summary</h3>
                  <p>
                    Expiry is checked at the read boundary. Stale entries are removed before returning
                    a miss, while unexpired entries keep the existing path.
                  </p>
                </div>
                <div className="rd-block">
                  <h3>Files touched</h3>
                  <ul>
                    <li><span className="rd-inline-code">src/cache.ts</span> · read boundary</li>
                    <li><span className="rd-inline-code">src/cache.test.ts</span> · boundary regression</li>
                  </ul>
                </div>
              </>
            )}
          </article>

          <aside className="rd-margin" {...regionProps("margin-notes", "Source-linked margin notes", "annotation")}>
            <div className="fw-label">Reviewer margin</div>
            <div className="rd-note">
              <div className="rd-note-label">Verification · supported</div>
              <p>The stated boundary check appears in the test run.</p>
              <a href="/embed/review-source#evt-0261">↗ event 0261</a>
            </div>
            <div className="rd-note">
              <div className="rd-note-label">Verification · complicates</div>
              <p>The stale-entry branch was not isolated in the first check.</p>
              <a href="/embed/review-source#evt-0337">↗ event 0337</a>
            </div>
            <div className="rd-note">
              <div className="rd-note-label">Handoff · open</div>
              <p>Rollback conditions are not named in the handoff.</p>
              <a href="/embed/review-source#evt-0489">↗ artifact lines 18–31</a>
            </div>
          </aside>
        </div>
      </section>

      <footer className="rd-provenance" {...regionProps("provenance", "Document provenance", "footer")}>
        <span>sha256 · 86a04bd2…18c1 · captured without reviewer edits</span>
        <span>workspace clock · 01:03:12</span>
      </footer>
    </SurfaceShell>
  );
}
