/** Review · Source — traceable command log and diff viewer sketch. */

import { useState } from "react";
import { SurfaceShell, regionProps } from "./SurfaceShell";

const CSS = `
.rs-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 30px;
}
.rs-trace {
  min-width: 240px;
  padding: 13px 15px;
  border: 1px solid var(--edge);
  border-radius: 8px;
  background: var(--raised);
}
.rs-trace-label {
  color: var(--faint);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.rs-trace-value { margin-top: 6px; color: var(--capture); font-family: var(--mono); font-size: 11px; }
.rs-viewer {
  margin-top: 28px;
  overflow: hidden;
  border: 1px solid rgba(33, 31, 28, 0.28);
  border-radius: 12px;
  background: var(--instr);
  color: var(--instr-ink);
  box-shadow: 0 24px 60px rgba(33, 31, 28, 0.15);
}
.rs-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: #25262a;
}
.rs-tabs { align-self: stretch; display: flex; }
.rs-tab {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--instr-faint);
  padding: 0 13px;
  font-family: var(--mono);
  font-size: 10px;
}
.rs-tab[data-active="true"] { border-bottom-color: var(--capture); color: var(--instr-ink); }
.rs-seal { color: #76a48e; font-family: var(--mono); font-size: 9px; letter-spacing: 0.06em; }
.rs-code {
  min-height: 440px;
  padding: 22px 0 30px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.75;
}
.rs-line {
  display: grid;
  grid-template-columns: 58px 88px minmax(660px, 1fr);
  min-width: 850px;
  padding: 0 22px 0 0;
}
.rs-line[data-focus="true"] {
  background: rgba(90, 125, 134, 0.18);
  box-shadow: inset 3px 0 #6f9ba5;
}
.rs-no { color: #66686d; text-align: right; padding-right: 18px; user-select: none; }
.rs-time { color: #888b91; }
.rs-text { white-space: pre; color: #d7d6d2; }
.rs-prompt { color: #83aeb7; }
.rs-ok, .rs-add { color: #76a48e; }
.rs-warn { color: #d0a44d; }
.rs-remove { color: #c6765a; }
.rs-context {
  margin-top: 22px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}
.rs-note {
  padding: 16px 18px;
  border: 1px solid var(--hairline);
  border-radius: 9px;
  background: var(--raised);
}
.rs-note-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faint);
}
.rs-note p { margin: 9px 0 0; color: var(--soft); font-size: 13px; line-height: 1.5; }

@media (max-width: 760px) {
  .rs-header, .rs-context { grid-template-columns: 1fr; }
  .rs-trace { min-width: 0; }
  .rs-toolbar { align-items: stretch; flex-direction: column; padding-top: 8px; }
  .rs-seal { padding: 0 12px 10px; }
}
`;

const logLines = [
  ["331", "00:38:52", "$ bun test src/cache.test.ts", "prompt"],
  ["332", "00:38:53", "bun test v1.2.18", ""],
  ["333", "00:38:53", "✓ returns a miss when the key is absent", "ok"],
  ["334", "00:38:53", "✓ returns a cached value before expiry", "ok"],
  ["335", "00:38:53", "✓ treats the expiry boundary as stale", "ok"],
  ["336", "00:38:53", "3 pass · 0 fail · 7 expect() calls", "ok"],
  ["337", "00:39:16", "# note: stale-entry removal path not isolated", "warn"],
  ["338", "00:39:22", "$ git diff -- src/cache.ts src/cache.test.ts", "prompt"],
  ["339", "00:39:22", "diff --git a/src/cache.ts b/src/cache.ts", ""],
  ["340", "00:39:22", "+ if (entry.expiresAt <= clock.now()) {", "ok"],
  ["341", "00:39:22", "+   store.delete(key)", "ok"],
  ["342", "00:39:22", "+   return undefined", "ok"],
  ["343", "00:39:22", "+ }", "ok"],
] as const;

const diffLines = [
  ["38", "cache.ts", "@@ -38,6 +38,11 @@ export function readEntry(key: string)", ""],
  ["39", "cache.ts", "   const entry = store.get(key)", ""],
  ["40", "cache.ts", "   if (!entry) return undefined", ""],
  ["41", "cache.ts", "+  if (entry.expiresAt <= clock.now()) {", "add"],
  ["42", "cache.ts", "+    store.delete(key)", "add"],
  ["43", "cache.ts", "+    return undefined", "add"],
  ["44", "cache.ts", "+  }", "add"],
  ["45", "cache.ts", "   return entry.value", ""],
  ["46", "cache.ts", " }", ""],
  ["47", "cache.test", "+it(\"treats the expiry boundary as stale\", () => {", "add"],
  ["48", "cache.test", "+  expect(readEntry(\"alpha\")).toBeUndefined()", "add"],
  ["49", "cache.test", "+})", "add"],
] as const;

export function ReviewSource() {
  const [tab, setTab] = useState<"log" | "diff">("log");
  const lines = tab === "log" ? logLines : diffLines;

  return (
    <SurfaceShell wide>
      <style>{CSS}</style>
      <header className="rs-header" {...regionProps("header", "Source header", "header")}>
        <div>
          <div className="fw-eyebrow">Review · Source</div>
          <h1 className="fw-title">Trace the note back to the event.</h1>
          <p className="fw-lede">A reviewer interpretation is never the only copy. The captured command, output, and patch stay one step away.</p>
        </div>
        <div className="rs-trace">
          <div className="rs-trace-label">Opened from moment</div>
          <div className="rs-trace-value">evt-0337 · verification</div>
        </div>
      </header>

      <section className="rs-viewer" {...regionProps("source-viewer", "Captured source viewer", "source", "Command log and file diff")}>
        <div className="rs-toolbar">
          <div className="rs-tabs" role="tablist" aria-label="Captured sources">
            <button type="button" className="rs-tab" data-active={tab === "log"} onClick={() => setTab("log")}>terminal/session.log</button>
            <button type="button" className="rs-tab" data-active={tab === "diff"} onClick={() => setTab("diff")}>workspace.patch</button>
          </div>
          <div className="rs-seal">● capture sealed · sha 86a04bd2…18c1</div>
        </div>
        <div className="rs-code" role="region" aria-label={tab === "log" ? "Command log" : "File diff"}>
          {lines.map(([number, time, content, tone]) => (
            <div className="rs-line" data-focus={number === "337" || number === "41"} key={`${tab}-${number}`}>
              <span className="rs-no">{number}</span>
              <span className="rs-time">{time}</span>
              <span className={`rs-text ${tone ? `rs-${tone}` : ""}`}>{content}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rs-context" {...regionProps("interpretation", "Evidence interpretation", "annotation")}>
        <div className="rs-note">
          <div className="rs-note-head"><span>Supports</span><span>evt-0261</span></div>
          <p>The candidate added a focused boundary regression and ran it successfully.</p>
        </div>
        <div className="rs-note">
          <div className="rs-note-head"><span>Complicates</span><span>evt-0337</span></div>
          <p>The first run did not independently exercise stale-entry deletion. The patch suggests it; the check does not prove it.</p>
        </div>
      </section>
    </SurfaceShell>
  );
}
