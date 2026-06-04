// ─────────────────────────────────────────────────────────────────────────────
// Hudson Showroom
// ─────────────────────────────────────────────────────────────────────────────
// Working demo apps, on display. Each is a complete HudsonApp built ONLY on the
// published `hudsonkit` surface (+ react, lucide-react) — so the Showroom doubles
// as live dogfooding: if an app needs something the Kit doesn't export, that's a
// gap in the SDK, not a reason to reach into host internals.
//
// The host registers these via `app/apps/registry.ts`, importing from the bare
// specifier `hudson-showroom`. See docs/hudson-kit-vs-showroom.md for the map.
// ─────────────────────────────────────────────────────────────────────────────

export { notepadApp } from './notepad';
export { codeEditorApp } from './code-editor';
export { documentLabApp } from './document-lab';
export { jsonExplorerApp } from './json-explorer';
export { apiInspectorApp } from './api-inspector';
export { webFetchApp } from './web-fetch';
export { traceViewerApp } from './trace-viewer';
export { workflowLabApp } from './workflow-lab';
