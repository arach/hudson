import { createPanelLayoutPersistence, panelPreset, type LayoutStorage } from '../../packages/web/hudsonkit/src/editor/layout-persistence';
const panelIds = ['chat', 'terminal', 'preview', 'history', 'source'];
export function startingPreset() {
  return { ...panelPreset(panelIds, ['chat', 'preview']), columnSizes: [38, 62] };
}
export function expandedPreset() {
  return { ...panelPreset(panelIds, ['chat', 'preview', 'history', 'source'], 'grid'),
    gridColumns: 2, columnSizes: [1, 1], rowSizes: [1, 1] };
}
export function createEditorLayoutPersistence(storage: LayoutStorage | undefined, subjectId: string) {
  // One-time app preset migration. Preserve old data and other kit consumers;
  // subsequent choices, including hiding panels, persist in the new namespace.
  return createPanelLayoutPersistence(storage, subjectId, startingPreset(),
    Object.fromEntries(panelIds.map(id => [id, subjectId])), 'lattices.editor.layout.v3');
}
export function selectionCountLabel(count: number) {
  return `${count} ${count === 1 ? 'window' : 'windows'} selected`;
}
