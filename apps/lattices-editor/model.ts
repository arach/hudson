import { isUICommand, type UICommand, type layoutState } from './ui';
import { createRevisionGuard, HostBridgeError, type HostBridge, type HostEnvelope } from '../../packages/web/hudsonkit/src/editor/host-bridge';
import { createSubjectStore, type EditorSubject, type EditorSelection, type SourceRange } from '../../packages/web/hudsonkit/src/editor/subject-store';
export interface Entry { key: string; layerId: string; canonical: string; ranges: SourceRange[]; ambiguous: boolean }
export interface PreviewRow { id: string; windowId: number; app: string; title: string; layerId: string | null; entryKeys: string[] }
export interface Projection { snapshotId: string; groups: { id: string; label: string; rows: PreviewRow[] }[]; entries: Entry[] }
interface SubjectRead { subject: EditorSubject; source: { text: string; language: 'json' } }
interface Capabilities { chrome?: 'host'; readOnly: boolean; methods: string[]; subject: Omit<EditorSubject, 'revision'> & { revision: string | null }; terminal: boolean }
export interface EditorState {
  chrome: 'host' | 'standalone'; uiError: string | null;
  status: 'loading' | 'ready' | 'unavailable' | 'error'; error: string | null;
  document: SubjectRead | null; projection: Projection | null;
  history: { revision: string; at: string }[];
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
function isSubject(x: unknown): x is EditorSubject {
  return record(x) && ['id', 'kind', 'label', 'revision'].every(k => typeof x[k] === 'string' && (x[k] as string).length > 0);
}
function isDiscoverySubject(x: unknown): x is Capabilities['subject'] {
  return record(x) && ['id', 'kind', 'label'].every(k => typeof x[k] === 'string' && x[k].length > 0) &&
    (x.revision === null || typeof x.revision === 'string' && x.revision.length > 0);
}
function validateDocument(payload: unknown, id: string, revision: string | null): asserts payload is SubjectRead {
  if (!record(payload) || !isSubject(payload.subject) || payload.subject.id !== id ||
    payload.subject.revision !== revision || !record(payload.source) || typeof payload.source.text !== 'string' || payload.source.language !== 'json') {
    throw new Error('Invalid source response');
  }
  JSON.parse(payload.source.text);
}
export function validateProjection(p: unknown, text: string): asserts p is Projection {
  if (!record(p) || typeof p.snapshotId !== 'string' || !Array.isArray(p.groups) || !Array.isArray(p.entries)) throw new Error('Invalid preview response');
  const keys = new Set<string>(), rows = new Set<string>(), groups = new Set<string>();
  for (const e of p.entries) {
    if (!record(e) || typeof e.key !== 'string' || keys.has(e.key) || typeof e.layerId !== 'string' ||
      typeof e.canonical !== 'string' || typeof e.ambiguous !== 'boolean' || !Array.isArray(e.ranges) || !e.ranges.length ||
      e.ranges.some(r => !record(r) || !Number.isInteger(r.from) || !Number.isInteger(r.to) ||
        (r.from as number) < 0 || (r.to as number) > text.length || (r.from as number) >= (r.to as number)) ||
      (e.ranges.length > 1 && !e.ambiguous)) throw new Error('Invalid preview entry ranges');
    keys.add(e.key);
  }
  for (const g of p.groups) {
    if (!record(g) || typeof g.id !== 'string' || groups.has(g.id) || typeof g.label !== 'string' || !Array.isArray(g.rows)) throw new Error('Invalid preview group');
    groups.add(g.id);
    for (const r of g.rows) {
      if (!record(r) || typeof r.id !== 'string' || rows.has(r.id) || !Number.isInteger(r.windowId) ||
        typeof r.app !== 'string' || typeof r.title !== 'string' || !(r.layerId === null || typeof r.layerId === 'string') ||
        !Array.isArray(r.entryKeys) || r.entryKeys.some(k => typeof k !== 'string' || !keys.has(k))) throw new Error('Invalid preview row');
      rows.add(r.id);
    }
  }
}
export function selectionForKeys(projection: Projection, keys: string[], origin: string, rowIds: string[] = []): EditorSelection {
  const entries = projection.entries.filter(e => keys.includes(e.key));
  const rows = projection.groups.flatMap(g => g.rows).filter(r => origin === 'preview' ? rowIds.includes(r.id) : rowIds.includes(r.id) || r.entryKeys.some(k => keys.includes(k)));
  return { origin, ambiguous: entries.some(e => e.ambiguous), ranges: entries.flatMap(e => e.ranges), refs: [
    ...entries.map(e => ({ kind: 'lattices.entry', id: e.key, label: e.layerId, detail: e.canonical, snapshotId: projection.snapshotId })),
    ...rows.map(r => ({ kind: 'lattices.window', id: r.id, label: r.title || r.app, snapshotId: projection.snapshotId })),
  ] };
}
export function selectionForRanges(projection: Projection, ranges: SourceRange[]) {
  const keys = projection.entries.filter(e => e.ranges.some(entry => ranges.some(r =>
    r.from === r.to ? r.from >= entry.from && r.from < entry.to : r.from < entry.to && r.to > entry.from))).map(e => e.key);
  return selectionForKeys(projection, keys, 'source');
}
export function createEditorModel(bridge: HostBridge) {
  const selection = createSubjectStore();
  let state: EditorState = { chrome: 'standalone', uiError: null, status: 'loading', error: null, document: null, projection: null, history: [] };
  const uiListeners = new Set<(command: UICommand) => void>();
  const uiQueue: UICommand[] = [];
  let uiSend = Promise.resolve();
  const listeners = new Set<() => void>();
  const guard = createRevisionGuard();
  let subjectId: string | null = null, disposed = false, refreshing = false, pending = false;
  let subscribed = false;
  const emit = (patch: Partial<EditorState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  async function refresh() {
    if (disposed || !subjectId || !subscribed) return;
    pending = true;
    if (refreshing) return;
    refreshing = true;
    let staleRetries = 0;
    try {
      while (pending && !disposed) {
        pending = false;
        const token = guard.capture();
        try {
          const read = await bridge.request<SubjectRead>('subject.read', subjectId, null);
          if (!guard.accepts(token, read.revision)) { pending = true; continue; }
          validateDocument(read.payload, subjectId, read.revision);
          const projected = await bridge.request<Projection>('preview.project', subjectId, read.revision);
          if (!guard.accepts(token, projected.revision)) { pending = true; continue; }
          validateProjection(projected.payload, read.payload.source.text);
          const previous = selection.getSnapshot().selection;
          selection.setSubject(read.payload.subject);
          selection.select(selectionForKeys(projected.payload,
            previous.refs.filter(r => r.kind === 'lattices.entry').map(r => r.id), previous.origin,
            previous.refs.filter(r => r.kind === 'lattices.window').map(r => r.id)));
          emit({ document: read.payload, projection: projected.payload, status: 'ready', error: null });
          staleRetries = 0;
        } catch (error) {
          if (disposed) break;
          if (!guard.accepts(token, token.revision)) { pending = true; continue; }
          if (error instanceof HostBridgeError && error.code === 'stale_revision' && staleRetries++ < 2) { pending = true; continue; }
          emit({ status: state.document ? 'ready' : 'error', error: error instanceof Error ? error.message : 'Could not refresh the editor' });
        }
      }
    } finally { refreshing = false; }
  }
  function receive(event: HostEnvelope) {
    if (event.kind === 'ui.command') {
      if (state.chrome !== 'host' || event.subjectId !== subjectId || !isUICommand(event.payload)) return;
      if (uiListeners.size) uiListeners.forEach(fn => fn(event.payload as UICommand));
      else { uiQueue.push(event.payload); if (uiQueue.length > 32) uiQueue.shift(); }
      return;
    }
    if (event.subjectId !== subjectId || !['config.changed', 'windows.changed'].includes(event.kind) ) return;
    const p = event.payload;
    if (!record(p) || typeof p.at !== 'string' || !Number.isFinite(Date.parse(p.at)) || typeof p.subscriptionId !== 'string') return;
    guard.invalidate(null);
    if (event.kind === 'config.changed' && event.revision) emit({ history: [...state.history, { revision: event.revision, at: p.at }].slice(-1000) });
    void refresh();
  }
  const unsubscribe = bridge.subscribe(receive);
  async function start() {
      try {
        const capabilities = await bridge.request<Capabilities>('capabilities', null, null);
        const c = capabilities.payload;
        if (!record(c) || !isDiscoverySubject(c.subject) || !Array.isArray(c.methods) || c.readOnly !== true ||
          !['subject.read', 'preview.project', 'events.subscribe'].every(m => c.methods.includes(m)) ||
          capabilities.subjectId !== c.subject.id || capabilities.revision !== c.subject.revision) throw new HostBridgeError('unsupported', 'Required editor capability missing');
        subjectId = c.subject.id;
        emit({ chrome: c.chrome === 'host' ? 'host' : 'standalone' });
        await bridge.request('events.subscribe', subjectId, null);
        if (disposed) return;
        subscribed = true;
        await refresh();
      } catch (error) {
        if (!disposed) emit({ status: error instanceof HostBridgeError && error.code === 'unsupported' ? 'unavailable' : 'error', error: error instanceof Error ? error.message : 'Host unavailable' });
      }
    }
  return {
    selection,
    subscribeUI(listener: (command: UICommand) => void) {
      uiListeners.add(listener); uiQueue.splice(0).forEach(listener);
      return () => { uiListeners.delete(listener); };
    },
    reportLayout(payload: ReturnType<typeof layoutState>) {
      if (state.chrome !== 'host' || disposed) return Promise.resolve();
      uiSend = uiSend.then(async () => {
        if (disposed) return;
        try { await bridge.request('ui.state', subjectId, null, payload); emit({ uiError: null }); }
        catch (error) { if (!disposed) emit({ uiError: error instanceof Error ? error.message : 'Could not sync layout' }); }
      });
      return uiSend;
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start,
    retry: () => subscribed ? refresh() : start(),
    refresh,
    selectRows(ids: string[]) {
      if (!state.projection) return;
      const keys = state.projection.groups.flatMap(g => g.rows).filter(r => ids.includes(r.id)).flatMap(r => r.entryKeys);
      selection.select(selectionForKeys(state.projection, keys, 'preview', ids));
    },
    selectRanges(ranges: SourceRange[]) { if (state.projection) selection.select(selectionForRanges(state.projection, ranges)); },
    dispose() { disposed = true; guard.invalidate(); unsubscribe(); bridge.dispose(); listeners.clear(); uiListeners.clear(); uiQueue.length = 0; },
  };
}
export type EditorModel = ReturnType<typeof createEditorModel>;
