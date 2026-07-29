// ─────────────────────────────────────────────────────────────────────────────
// HudsonKit batteries — generic built-in apps shipped with the kit
// ─────────────────────────────────────────────────────────────────────────────
// "Batteries included": client-only HudsonApps that depend on nothing beyond the
// kit's own runtime dependencies. They ship as a separate `hudsonkit/apps`
// entry so the core bundle stays app-free — consumers opt in via the subpath.
// Domain/creative apps live in downstream hosts such as Atelier, not here.
// ─────────────────────────────────────────────────────────────────────────────

export { notepadApp } from './notepad';
export { codeEditorApp } from './code-editor';
export { documentLabApp } from './document-lab';
export { jsonExplorerApp } from './json-explorer';
export { apiInspectorApp } from './api-inspector';
export { webFetchApp } from './web-fetch';
export { traceViewerApp } from './trace-viewer';
export { workflowLabApp } from './workflow-lab';

// Public types consumed by host API routes (e.g. app/api/traces/route.ts).
export type { AgentTrace, TraceSummary } from './trace-viewer/types';
