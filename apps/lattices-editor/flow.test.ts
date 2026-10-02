import { test, expect } from 'bun:test';
import { createHostBridge } from '../../packages/web/hudsonkit/src/editor/host-bridge';
import { createMockTransport } from './mock';
import { createEditorModel } from './model';
import { orderedGroups, relativeTime, removeContextRow, scrollRowIntoView, selectedRows, shortRevision, toggleRow } from './flow';
test('context mirrors selected rows, removal deselects just that row, even for a shared entry', async () => {
  const mock = createMockTransport({ rich: true });
  const model = createEditorModel(createHostBridge(mock.transport));
  await model.start();
  model.selectRows(['build:42','build:100']);
  expect(selectedRows(model.getSnapshot().projection, model.selection.getSnapshot().selection).map(row => row.id)).toEqual(['build:42','build:100']);
  removeContextRow(model, 'build:42');
  expect(selectedRows(model.getSnapshot().projection, model.selection.getSnapshot().selection).map(row => row.id)).toEqual(['build:100']);
  removeContextRow(model, 'build:100');
  expect(model.selection.getSnapshot().selection.refs).toHaveLength(0);
  model.dispose();
});
test('Unassigned sorts last, preserving other group order and empty groups', () => {
  const mock = createMockTransport({ rich: true });
  expect(orderedGroups(mock.fixture().projection).map(group => group.id)).toEqual(['scout','build','unassigned']);
  expect(orderedGroups(mock.fixture().projection)[0].rows).toHaveLength(0);
});
test('keyboard additive toggle and instant nearest cross-selection scrolling', () => {
  expect(toggleRow(['a'], 'b', true)).toEqual(['a','b']);
  expect(toggleRow(['a','b'], 'a', true)).toEqual(['b']);
  expect(toggleRow(['a'], 'b', false)).toEqual(['b']);
  const calls: unknown[] = [];
  scrollRowIntoView({ scrollIntoView: options => { calls.push(options); } });
  expect(calls).toEqual([{ block:'nearest', inline:'nearest', behavior:'instant' }]);
});
test('relative time and short hash are display-only', () => {
  expect(relativeTime('2026-10-01T10:00:00Z', Date.parse('2026-10-01T10:02:10Z'))).toBe('2 min ago');
  expect(shortRevision('sha256:1234567890abcdef')).toBe('1234567');
});
test('removing one shared-entry context does not reselect it', async () => {
  const mock = createMockTransport();
  const model = createEditorModel(createHostBridge({ ...mock.transport, async request(message) {
    const reply = await mock.transport.request(message) as { payload: { groups?: { rows: import('./model').PreviewRow[] }[] } };
    if (message.kind === 'preview.project') {
      const rows = reply.payload.groups![0].rows;
      rows.push({ ...rows[0], id: 'build:peer', windowId: 99, title: 'Another match' });
    }
    return reply;
  } }));
  await model.start();
  model.selectRows(['build:42','build:peer']);
  removeContextRow(model, 'build:42');
  expect(selectedRows(model.getSnapshot().projection, model.selection.getSnapshot().selection).map(row => row.id)).toEqual(['build:peer']);
  await model.refresh();
  expect(selectedRows(model.getSnapshot().projection, model.selection.getSnapshot().selection).map(row => row.id)).toEqual(['build:peer']);
  model.dispose();
});
