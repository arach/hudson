import { describe, test, expect } from 'bun:test';
import { createHostBridge, createRevisionGuard, createWKReplyTransport, type HostEnvelope, type HostTransport } from '../../packages/web/hudsonkit/src/editor/host-bridge';
import { createSubjectStore } from '../../packages/web/hudsonkit/src/editor/subject-store';
import { createPanelLayoutPersistence, panelPreset, parsePanelLayout } from '../../packages/web/hudsonkit/src/editor/layout-persistence';
import { createEditorModel, selectionForRanges, validateProjection } from './model';
import { createMockTransport } from './mock';
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const echo = (m: HostEnvelope): HostEnvelope => ({ ...m, kind: m.kind + '.result' });
function transport(request: HostTransport['request']): HostTransport { return { request, subscribe: () => () => {} }; }
describe('bridge', () => {
  for (const field of ['v', 'requestId', 'subjectId', 'kind']) test('rejects invalid ' + field, async () => {
    const bridge = createHostBridge(transport(async m => ({ ...echo(m), [field]: 'wrong' })));
    await expect(bridge.request('subject.read', 'subject', null)).rejects.toMatchObject({ code: 'invalid_reply' });
    bridge.dispose();
  });
  test('deadline and missing handler', async () => {
    const bridge = createHostBridge(transport(() => new Promise(() => {})), 5);
    await expect(bridge.request('capabilities', null, null)).rejects.toMatchObject({ code: 'timeout' });
    bridge.dispose();
    const missing = createHostBridge(createWKReplyTransport(new EventTarget()));
    await expect(missing.request('capabilities', null, null)).rejects.toMatchObject({ code: 'unsupported' });
    missing.dispose();
  });
  test('rejects projection revision mismatch and closes pending requests', async () => {
    const bridge = createHostBridge(transport(async m => ({ ...echo(m), revision: 'other' })));
    await expect(bridge.request('preview.project', 'id', 'current')).rejects.toMatchObject({ code: 'stale_revision' }); bridge.dispose();
    const pending = createHostBridge(transport(() => new Promise(() => {})));
    const reply = pending.request('capabilities', null, null); pending.dispose();
    await expect(reply).rejects.toMatchObject({ code: 'disposed' });
  });
  test('generation guards equal-revision inventory changes and ABA', () => {
    const guard = createRevisionGuard(); guard.invalidate('a');
    const token = guard.capture(); expect(guard.accepts(token, 'a')).toBe(true);
    expect(guard.accepts(token, 'b')).toBe(false);
    guard.invalidate('a'); expect(guard.accepts(token, 'a')).toBe(false);
    const next = guard.capture(); guard.invalidate('b'); guard.invalidate('a');
    expect(guard.accepts(next, 'a')).toBe(false);
  });
});
describe('model', () => {
  test('null discovery revision and unavailable recover on event', async () => {
    const mock = createMockTransport(); mock.invalid();
    const model = createEditorModel(createHostBridge(mock.transport));
    await model.start();
    expect(mock.calls.slice(0, 3)).toEqual(['capabilities', 'events.subscribe', 'subject.read']);
    expect(model.getSnapshot()).toMatchObject({ status: 'error', document: null, error: 'Synthetic workspace JSON is invalid.' });
    mock.recover(); await settle();
    expect(model.getSnapshot().status).toBe('ready');
    expect(model.getSnapshot().document?.subject.revision).toBe('mock:1');
    mock.invalid(); await settle(); expect(model.getSnapshot().error).toContain('invalid');
    expect(model.getSnapshot().document?.subject.revision).toBe('mock:1');
    mock.recover(); await settle(); expect(model.getSnapshot().error).toBeNull();
    model.dispose();
  });
  test('only missing capability/handler is unavailable', async () => {
    const missing = createEditorModel(createHostBridge(createWKReplyTransport(new EventTarget())));
    await missing.start(); expect(missing.getSnapshot().status).toBe('unavailable'); missing.dispose();
    const broken = createEditorModel(createHostBridge(transport(async () => { throw new Error('offline'); })));
    await broken.start(); expect(broken.getSnapshot().status).toBe('error'); broken.dispose();
  });
  test('stale_revision retries latest source without mutation', async () => {
    const mock = createMockTransport(); mock.stale();
    const model = createEditorModel(createHostBridge(mock.transport));
    await model.start();
    expect(model.getSnapshot().document?.subject.revision).toBe('mock:2');
    expect(mock.calls.filter(c => c === 'subject.read')).toHaveLength(2);
    expect(mock.calls.every(c => ['capabilities', 'events.subscribe', 'subject.read', 'preview.project'].includes(c))).toBe(true);
    model.dispose();
  });
  test('events before subscription reply and during projection are not lost', async () => {
    const mock = createMockTransport(); let invalidate = true;
    const wrapped = { ...mock.transport, async request(m: HostEnvelope) {
      const reply = await mock.transport.request(m);
      if (m.kind === 'events.subscribe') mock.change();
      if (m.kind === 'preview.project' && invalidate) { invalidate = false; mock.inventory(); }
      return reply;
    } };
    const model = createEditorModel(createHostBridge(wrapped)); await model.start();
    expect(model.getSnapshot().document?.subject.revision).toBe('mock:2');
    expect(model.getSnapshot().projection?.snapshotId).toBe('mock:snapshot:2:2');
    expect(model.getSnapshot().history).toHaveLength(1);
    expect(mock.calls.filter(c => c === 'preview.project')).toHaveLength(2);
    model.dispose();
  });
  test('duplicates highlight all UTF16 ranges and matching rows', async () => {
    const mock = createMockTransport(), { text, projection } = mock.fixture();
    validateProjection(projection, text);
    const entry = projection.entries[0];
    for (const range of entry.ranges) expect(JSON.parse(text.slice(range.from, range.to))).toEqual(JSON.parse(entry.canonical));
    const selection = selectionForRanges(projection, [entry.ranges[1]]);
    expect(selection.ambiguous).toBe(true); expect(selection.ranges).toEqual(entry.ranges);
    expect(selection.refs.filter(r => r.kind === 'lattices.window')).toHaveLength(1);
    const model = createEditorModel(createHostBridge(mock.transport)); await model.start();
    model.selectRows(['build:42']); expect(model.selection.getSnapshot().selection.ranges).toEqual(entry.ranges);
    model.selectRows(['unassigned:43']); expect(model.selection.getSnapshot().selection.ranges).toEqual([]);
    model.dispose();
  });
});
test('selection store capture is isolated and revision changes clear selection', () => {
  const store = createSubjectStore(); let updates = 0; const off = store.subscribe(() => updates++);
  store.setSubject({ id: 'a', kind: 'document', label: 'A', revision: '1' });
  store.select({ origin: 'test', ranges: [], ambiguous: false, refs: [{ kind: 'item', id: 'x', label: 'X' }] });
  const captured = store.capture(); store.clear();
  expect(captured.refs).toHaveLength(1); expect(store.getSnapshot().selection.refs).toHaveLength(0);
  store.setSubject({ id: 'a', kind: 'document', label: 'A', revision: '2' });
  expect(captured.subject?.revision).toBe('1'); expect(updates).toBe(4); off();
});
test('layout envelope contains only layout and bindings, rejects corruption, isolates subjects', () => {
  const map = new Map<string, string>(); const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  const preset = panelPreset(['a','b'], ['a']);
  const saved = createPanelLayoutPersistence(storage, 'one', preset, { a: 'one' });
  saved.save({ ...preset, columnSizes: [30,70], hiddenPanelIds: [] });
  expect(createPanelLayoutPersistence(storage, 'one', preset, { a: 'one' }).getLayout().columnSizes).toEqual([30,70]);
  expect(createPanelLayoutPersistence(storage, 'two', preset, { a: 'two' }).getLayout().hiddenPanelIds).toEqual(['b']);
  expect(parsePanelLayout('garbage')).toBeNull();
  expect(parsePanelLayout(JSON.stringify({v:1, layout: {...preset, columnSizes:[-1]}, bindings:{}}))).toBeNull();
});
