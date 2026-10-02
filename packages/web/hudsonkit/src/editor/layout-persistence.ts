import type { AgentWorkspacePanelLayoutState as Layout } from '../agent-panel-layout';
export interface PanelLayoutEnvelope { v: 1; layout: Layout; bindings: Record<string, string> }
export interface LayoutStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function panelPreset(order: string[], visible: string[], arrangement: Layout['arrangement'] = 'columns'): Layout {
  return { arrangement, order: [...order], hiddenPanelIds: order.filter(id => !visible.includes(id)),
    focusedPanelId: visible[0] ?? null, gridColumns: 3 };
}
export function parsePanelLayout(text: string | null): PanelLayoutEnvelope | null {
  try {
    const value = JSON.parse(text ?? 'null');
    const l = value?.layout;
    const ids = (a: unknown): a is string[] => Array.isArray(a) && a.every(x => typeof x === 'string') && new Set(a).size === a.length;
    const sizes = (a: unknown) => a === undefined || (Array.isArray(a) && a.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0));
    if (value?.v !== 1 || !l || !['single', 'columns', 'rows', 'grid'].includes(l.arrangement) ||
      !ids(l.order) || !ids(l.hiddenPanelIds) || !(l.focusedPanelId === null || typeof l.focusedPanelId === 'string') ||
      !sizes(l.columnSizes) || !sizes(l.rowSizes) ||
      !(l.gridColumns === undefined || (Number.isInteger(l.gridColumns) && l.gridColumns > 0)) ||
      !value.bindings || typeof value.bindings !== 'object' || Array.isArray(value.bindings) ||
      !Object.values(value.bindings).every(x => typeof x === 'string')) return null;
    // Rebuild rather than preserving unknown payloads; never persist panel content.
    return { v: 1, layout: { arrangement: l.arrangement, order: l.order, hiddenPanelIds: l.hiddenPanelIds,
      focusedPanelId: l.focusedPanelId, gridColumns: l.gridColumns, columnSizes: l.columnSizes, rowSizes: l.rowSizes }, bindings: value.bindings };
  } catch { return null; }
}
export function createPanelLayoutPersistence(storage: LayoutStorage | undefined, subjectId: string, preset: Layout, bindings: Record<string, string>, namespace = 'hudson.editor.layout.v1') {
  const key = `${namespace}:${encodeURIComponent(subjectId)}`;
  let wide: Layout = structuredClone(preset);
  try {
    const saved = parsePanelLayout(storage?.getItem(key) ?? null);
    if (saved && Object.entries(bindings).every(([id, binding]) => saved.bindings[id] === binding)) wide = saved.layout;
  } catch { /* Storage may be unavailable in an embedded origin. */ }
  return {
    getLayout: () => structuredClone(wide),
    save(layout: Layout) {
      wide = structuredClone(layout);
      try { storage?.setItem(key, JSON.stringify({ v: 1, layout: wide, bindings } satisfies PanelLayoutEnvelope)); return !!storage; }
      catch { return false; }
    },
  };
}
