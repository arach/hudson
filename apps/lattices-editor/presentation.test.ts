import { expect, test } from 'bun:test';
import { createEditorLayoutPersistence, expandedPreset, startingPreset, selectionCountLabel } from './presentation';
import { createPanelLayoutPersistence, panelPreset } from '../../packages/web/hudsonkit/src/editor/layout-persistence';
test('expanded preset fill a two-by-two grid, Terminal hidden', () => {
  const layout = expandedPreset();
  expect(layout.arrangement).toBe('grid');
  expect(layout.gridColumns).toBe(2);
  expect(layout.hiddenPanelIds).toEqual(['terminal']);
  expect(layout.order.filter(id => !layout.hiddenPanelIds.includes(id))).toEqual(['chat', 'preview', 'history', 'source']);
  expect(layout.columnSizes.length * layout.rowSizes.length).toBe(4);
});
test('starting preset shows Chat and wider Preview; other panels open on demand', () => {
  const layout = startingPreset();
  expect(layout.arrangement).toBe('columns');
  expect(layout.hiddenPanelIds).toEqual(['terminal','history','source']);
  expect(layout.order.filter(id => !layout.hiddenPanelIds.includes(id))).toEqual(['chat','preview']);
  expect(layout.columnSizes).toEqual([38,62]);
});
test('v1 and v2 layouts migrate once to v3 without resetting later choices', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const ids = expandedPreset().order;
  const bindings = Object.fromEntries(ids.map(id => [id,'workspace-layers']));
  const old = createPanelLayoutPersistence(storage, 'workspace-layers', panelPreset(ids, ['chat']), bindings);
  old.save(old.getLayout());
  const v2 = createPanelLayoutPersistence(storage, 'workspace-layers', expandedPreset(), bindings, 'lattices.editor.layout.v2');
  v2.save(v2.getLayout());
  const originals = new Map(data);
  const migrated = createEditorLayoutPersistence(storage, 'workspace-layers');
  expect(migrated.getLayout()).toEqual(startingPreset());
  migrated.save({ ...expandedPreset(), columnSizes: [35,65] });
  expect(createEditorLayoutPersistence(storage, 'workspace-layers').getLayout().hiddenPanelIds).toEqual(['terminal']);
  expect(createEditorLayoutPersistence(storage, 'workspace-layers').getLayout().arrangement).toBe('grid');
  expect(createEditorLayoutPersistence(storage, 'workspace-layers').getLayout().columnSizes).toEqual([35,65]);
  for (const [key,value] of originals) expect(storage.getItem(key)).toBe(value);
  expect(createEditorLayoutPersistence(storage, 'another-subject').getLayout()).toEqual(startingPreset());
});
test('selection counts agree for zero, one and many', () => {
  expect(selectionCountLabel(0)).toBe('0 windows selected');
  expect(selectionCountLabel(1)).toBe('1 window selected');
  expect(selectionCountLabel(2)).toBe('2 windows selected');
});
