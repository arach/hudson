import { expect, test } from 'bun:test';
import { createEditorLayoutPersistence, expandedPreset, selectionCountLabel } from './presentation';
import { createPanelLayoutPersistence, panelPreset } from '../../packages/web/hudsonkit/src/editor/layout-persistence';
test('default and expanded preset fill a two-by-two grid, Terminal hidden', () => {
  const layout = expandedPreset();
  expect(layout.arrangement).toBe('grid');
  expect(layout.gridColumns).toBe(2);
  expect(layout.hiddenPanelIds).toEqual(['terminal']);
  expect(layout.order.filter(id => !layout.hiddenPanelIds.includes(id))).toEqual(['chat', 'preview', 'history', 'source']);
  expect(layout.columnSizes.length * layout.rowSizes.length).toBe(4);
});
test('old layout migrates once without resetting subsequent layout choices', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const ids = expandedPreset().order;
  const old = createPanelLayoutPersistence(storage, 'workspace-layers', panelPreset(ids, ['chat','preview']), Object.fromEntries(ids.map(id => [id,'workspace-layers'])));
  old.save(old.getLayout());
  const original = storage.getItem('hudson.editor.layout.v1:workspace-layers');
  const migrated = createEditorLayoutPersistence(storage, 'workspace-layers');
  expect(migrated.getLayout()).toEqual(expandedPreset());
  migrated.save({ ...migrated.getLayout(), hiddenPanelIds: ['terminal','chat'], columnSizes: [35,65] });
  expect(createEditorLayoutPersistence(storage, 'workspace-layers').getLayout().hiddenPanelIds).toEqual(['terminal','chat']);
  expect(createEditorLayoutPersistence(storage, 'workspace-layers').getLayout().columnSizes).toEqual([35,65]);
  expect(storage.getItem('hudson.editor.layout.v1:workspace-layers')).toBe(original);
  expect(createEditorLayoutPersistence(storage, 'another-subject').getLayout()).toEqual(expandedPreset());
});
test('selection counts agree for zero, one and many', () => {
  expect(selectionCountLabel(0)).toBe('0 windows selected');
  expect(selectionCountLabel(1)).toBe('1 window selected');
  expect(selectionCountLabel(2)).toBe('2 windows selected');
});
