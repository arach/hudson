import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { HudsonApp } from '../../packages/web/hudsonkit/src/types/app';
import { EditorPanels } from '../../packages/web/hudsonkit/src/editor-panels';
import { createReadOnlyCodeSurface } from '../../packages/web/hudsonkit/src/editor/code-surface';
import { createPanelLayoutPersistence, panelPreset } from '../../packages/web/hudsonkit/src/editor/layout-persistence';
import type { AgentWorkspaceController } from '../../packages/web/hudsonkit/src/agent-workspace';
import type { EditorModel } from './model';
const Context = createContext<EditorModel | null>(null);
const useModel = () => { const model = useContext(Context); if (!model) throw new Error('Editor Provider required'); return model; };
const useData = () => { const model = useModel(); return useSyncExternalStore(model.subscribe, model.getSnapshot); };
const useSelection = () => { const model = useModel(); return useSyncExternalStore(model.selection.subscribe, model.selection.getSnapshot).selection; };
function Chat() { return <div className="placeholder"><h2>Chat</h2><p>Inspect your live configuration in Preview or Source.</p><textarea aria-label="Agent coming in slice 3" placeholder="Agent coming in slice 3" disabled /></div>; }
function Terminal() { return <div className="placeholder"><h2>Terminal unavailable</h2><p>This read-only editor does not connect to a terminal.</p></div>; }
function History() {
  const { history } = useData();
  return <div className="history"><p className="hint">External configuration changes during this session.</p>{!history.length ? <p>No external changes yet.</p> : <ol>{[...history].reverse().map((entry, i) =>
    <li key={`${entry.at}:${i}`}><strong>Configuration changed</strong><time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString()}</time><code>{entry.revision}</code></li>)}</ol>}</div>;
}
function Preview() {
  const { projection } = useData(); const model = useModel(); const selection = useSelection();
  const selected = selection.refs.filter(r => r.kind === 'lattices.window').map(r => r.id);
  return <div className="preview">{projection?.groups.map(group => <section key={group.id} aria-label={group.label}>
    <h2>{group.label}<span>{group.rows.length}</span></h2>
    {!group.rows.length && <p className="empty">No windows</p>}
    {group.rows.map(row => <button type="button" className="preview-row" key={row.id} aria-pressed={selected.includes(row.id)} onClick={event => {
      const additive = event.metaKey || event.ctrlKey;
      model.selectRows(additive ? selected.includes(row.id) ? selected.filter(id => id !== row.id) : [...selected, row.id] : [row.id]);
    }}><strong>{row.title || 'Untitled window'}</strong><span>{row.app}</span></button>)}
  </section>)}</div>;
}
function Source() {
  const model = useModel(); const { document } = useData(); const selection = useSelection();
  const host = useRef<HTMLDivElement>(null); const surface = useRef<ReturnType<typeof createReadOnlyCodeSurface> | null>(null);
  useLayoutEffect(() => {
    surface.current = createReadOnlyCodeSurface(host.current!, { text: '', onSelect: model.selectRanges });
    return () => { surface.current?.destroy(); surface.current = null; };
  }, [model]);
  useLayoutEffect(() => { surface.current?.setText(document?.source.text ?? ''); }, [document?.source.text]);
  useLayoutEffect(() => { surface.current?.highlight(selection.ranges); }, [selection]);
  return <div className="source"><div className="source-label">JSON · Read only</div><div className="code-host" ref={host} /></div>;
}
function Content() {
  const model = useModel(); const data = useData(); const selection = useSelection();
  const shell = useRef<AgentWorkspaceController | null>(null);
  const [storageNotice, setStorageNotice] = useState(false);
  const panels = useMemo(() => [
    { id: 'chat', label: 'Chat', content: <Chat /> },
    { id: 'terminal', label: 'Terminal', content: <Terminal /> },
    { id: 'preview', label: 'Preview', content: <Preview /> },
    { id: 'history', label: 'History & Results', content: <History /> },
    { id: 'source', label: 'Source', content: <Source /> },
  ], []);
  const id = data.document?.subject.id;
  const persistence = useMemo(() => {
    if (!id) return null;
    let storage: Storage | undefined;
    try { storage = globalThis.localStorage; } catch { /* Report on save. */ }
    const preset = { ...panelPreset(panels.map(p => p.id), ['chat', 'preview']), columnSizes: [38, 62] };
    return createPanelLayoutPersistence(storage, id, preset, Object.fromEntries(panels.map(p => [p.id, id])));
  }, [id, panels]);
  if (data.status === 'unavailable') return <main className="fallback"><h1>Editor unavailable in this Lattices version</h1><p>Update Lattices to a version with the read-only Editor bridge.</p></main>;
  if (!persistence) return <main className="fallback"><h1>{data.status === 'error' ? 'Could not load the editor' : 'Loading Workspace Layers…'}</h1>{data.error && <><p role="alert">{data.error}</p><button onClick={() => void model.refresh()}>Retry</button></>}</main>;
  return <main className="editor-root">
    <header className="editor-heading"><h1>{data.document?.subject.label}</h1><span>Read only</span><button onClick={() => shell.current?.showPanel('source')}>Inspect Source</button><button onClick={() => shell.current?.setPanelLayout({ ...panelPreset(panels.map(p => p.id), ['chat', 'preview', 'history', 'source'], 'grid'), columnSizes: [1, 1, 1], rowSizes: [1, 1] })}>Expanded layout</button></header>
    {data.error && <div className="notice" role="alert">Showing the last consistent view. {data.error} <button onClick={() => void model.refresh()}>Retry</button></div>}
    {storageNotice && <div className="notice" role="status">Layout could not be saved on this device.</div>}
    <div className="selection-status" role="status">{selection.ambiguous ? 'Ambiguous entry: duplicate source entries. All candidate ranges are highlighted.' : selection.refs.length ? `${selection.refs.filter(r => r.kind === 'lattices.window').length} windows selected` : 'Select a window or a Source range to inspect its matches.'}</div>
    <EditorPanels key={id} panels={panels} layout={persistence.getLayout()} onReady={controller => { shell.current = controller; }} onLayoutChange={layout => setStorageNotice(!persistence.save(layout))} />
  </main>;
}
export function createLatticesEditorApp(model: EditorModel): HudsonApp {
  function Provider({ children }: { children: ReactNode }) {
    useEffect(() => { void model.start(); return () => model.dispose(); }, []);
    return <Context.Provider value={model}>{children}</Context.Provider>;
  }
  return { id: 'lattices-editor', name: 'Lattices Editor', mode: 'panel', Provider,
    slots: { Content }, hooks: { useCommands: () => [], useStatus: () => ({ label: 'READ ONLY', color: 'neutral' }) } };
}
