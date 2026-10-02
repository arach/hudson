import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { HudsonApp } from '../../packages/web/hudsonkit/src/types/app';
import { EditorPanels } from '../../packages/web/hudsonkit/src/editor-panels';
import { createReadOnlyCodeSurface } from '../../packages/web/hudsonkit/src/editor/code-surface';
import { createEditorLayoutPersistence, expandedPreset, selectionCountLabel } from './presentation';
import type { AgentWorkspaceController } from '../../packages/web/hudsonkit/src/agent-workspace';
import type { EditorModel } from './model';
import { glyphTint, isUnassigned, orderedGroups, relativeTime, removeContextRow, rowLabel, scrollRowIntoView, selectedRows, shortRevision, toggleRow } from './flow';
const Context = createContext<EditorModel | null>(null);
const useModel = () => { const model = useContext(Context); if (!model) throw new Error('Editor Provider required'); return model; };
const useData = () => { const model = useModel(); return useSyncExternalStore(model.subscribe, model.getSnapshot); };
const useSelection = () => { const model = useModel(); return useSyncExternalStore(model.selection.subscribe, model.selection.getSnapshot).selection; };
function Chat() {
  const model = useModel(); const { projection } = useData(); const selection = useSelection();
  const rows = selectedRows(projection, selection);
  return <div className="context-panel">
    <div className="context-chips" aria-label="Selected windows">
      {rows.length ? rows.map(row => <span className="context-chip" key={row.id} title={rowLabel(row)}>
        <span className={`app-glyph tint-${glyphTint(row.app)}`} aria-hidden="true">{Array.from(row.app)[0]?.toUpperCase() || '?'}</span>
        <span className="chip-label">{rowLabel(row)}</span>
        <button type="button" aria-label={`Remove ${rowLabel(row)}`} onClick={() => removeContextRow(model, row.id)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </span>) : <p className="context-hint">Select windows in Preview to add them as context.</p>}
    </div>
    <div className="context-examples"><p>When an agent is available, you can ask:</p>
      <ul><li>Put these in Build and tile them</li><li>Explain why these windows are grouped together</li><li>Show me the settings for these windows</li></ul>
    </div>
    <textarea className="context-composer" aria-label="Ask about these windows (agent unavailable)" placeholder="Ask about these windows… (agent arrives in a later version)" disabled />
  </div>;
}
function Terminal() { return <div className="placeholder"><p>This read-only editor does not connect to a terminal.</p></div>; }
function History() {
  const { history } = useData();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  return <div className="history">{!history.length
    ? <p className="hint">Changes made elsewhere (for example, the menu bar) appear here.</p>
    : <ol>{[...history].reverse().map((entry, i) =>
      <li key={`${entry.at}:${i}`}><span>Configuration changed</span>
        <time dateTime={entry.at} title={new Date(entry.at).toLocaleString()}>{relativeTime(entry.at, now)}</time>
        <code title={entry.revision}>{shortRevision(entry.revision)}</code>
      </li>)}</ol>}</div>;
}
function Preview() {
  const { projection } = useData(); const model = useModel(); const selection = useSelection();
  const selected = selectedRows(projection, selection).map(row => row.id);
  const groups = orderedGroups(projection); const rows = groups.flatMap(group => group.rows);
  const [active, setActive] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const rowNodes = useRef(new Map<string, HTMLDivElement>());
  const activeRow = rows.find(row => row.id === active) ?? rows.find(row => selected.includes(row.id)) ?? rows[0];
  const optionId = (id: string) => `preview-row-${encodeURIComponent(id)}`;
  useLayoutEffect(() => {
    if (selection.origin === 'source') {
      const first = selection.refs.find(ref => ref.kind === 'lattices.window');
      if (first) scrollRowIntoView(rowNodes.current.get(first.id));
    }
  }, [selection]);
  return <div className="preview" ref={list} role="listbox" aria-label="Windows" aria-multiselectable="true"
    tabIndex={0} aria-activedescendant={activeRow ? optionId(activeRow.id) : undefined}
    onKeyDown={event => {
      const index = activeRow ? rows.findIndex(row => row.id === activeRow.id) : -1;
      let next = index;
      if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, index + 1);
      else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = rows.length - 1;
      else if ((event.key === ' ' || event.key === 'Enter') && activeRow) {
        event.preventDefault(); model.selectRows(toggleRow(selected, activeRow.id, event.metaKey || event.ctrlKey)); return;
      } else return;
      event.preventDefault();
      if (rows[next]) { setActive(rows[next].id); scrollRowIntoView(rowNodes.current.get(rows[next].id)); }
    }}>
    {groups.map(group => <section key={group.id} role="group" aria-label={group.label}
      className={isUnassigned(group) ? 'preview-group unassigned' : 'preview-group'}>
      {!group.rows.length ? <p className="empty-group">{group.label} · no windows</p> : <>
        <h2>{group.label}<span className="count-badge">{group.rows.length}</span></h2>
        {group.rows.map(row => <div role="option" aria-selected={selected.includes(row.id)}
          aria-label={rowLabel(row)} title={rowLabel(row)} className="preview-row" id={optionId(row.id)} key={row.id}
          data-active={activeRow?.id === row.id} ref={node => { if (node) rowNodes.current.set(row.id, node); else rowNodes.current.delete(row.id); }}
          onClick={event => { setActive(row.id); list.current?.focus({ preventScroll: true }); model.selectRows(toggleRow(selected, row.id, event.metaKey || event.ctrlKey)); }}>
          <span className={`app-glyph tint-${glyphTint(row.app)}`} aria-hidden="true">{Array.from(row.app)[0]?.toUpperCase() || '?'}</span>
          <span className="row-title">{row.title || 'Untitled window'}</span><span className="row-app">{row.app}</span>
        </div>)}
      </>}
    </section>)}
  </div>;
}
function Source() {
  const model = useModel(); const { document } = useData(); const selection = useSelection();
  const host = useRef<HTMLDivElement>(null); const surface = useRef<ReturnType<typeof createReadOnlyCodeSurface> | null>(null);
  useLayoutEffect(() => {
    surface.current = createReadOnlyCodeSurface(host.current!, { text: '', onSelect: model.selectRanges });
    return () => { surface.current?.destroy(); surface.current = null; };
  }, [model]);
  useLayoutEffect(() => { surface.current?.setText(document?.source.text ?? ''); }, [document?.source.text]);
  useLayoutEffect(() => { surface.current?.highlight(selection.ranges, { scroll: selection.origin !== 'source' }); }, [selection]);
  return <div className="source"><div className="source-label">workspace.json · layers subset</div><div className="code-host" ref={host} /></div>;
}
function Content() {
  const model = useModel(); const data = useData(); const selection = useSelection();
  const shell = useRef<AgentWorkspaceController | null>(null);
  const [storageNotice, setStorageNotice] = useState(false);
  const panels = useMemo(() => [
    { id: 'chat', label: 'Chat', showActions: false, content: <Chat /> },
    { id: 'terminal', label: 'Terminal', showActions: false, content: <Terminal /> },
    { id: 'preview', label: 'Preview', showActions: false, content: <Preview /> },
    { id: 'history', label: 'History & Results', showActions: false, content: <History /> },
    { id: 'source', label: 'Source', showActions: false, content: <Source /> },
  ], []);
  const id = data.document?.subject.id;
  const persistence = useMemo(() => {
    if (!id) return null;
    let storage: Storage | undefined;
    try { storage = globalThis.localStorage; } catch { /* Report on save. */ }
    return createEditorLayoutPersistence(storage, id);
  }, [id]);
  if (data.status === 'unavailable') return <main className="fallback"><h1>Editor unavailable in this Lattices version</h1><p>Update Lattices to a version with the read-only Editor bridge.</p></main>;
  if (!persistence) return <main className="fallback"><h1>{data.status === 'error' ? "Can't read workspace layers" : 'Loading Workspace Layers…'}</h1>{data.error && <><p role="alert">{data.error}</p><button onClick={() => void model.retry()}>Retry</button></>}</main>;
  return <main className="editor-root">
    <header className="editor-heading"><h1>{data.document?.subject.label}</h1><span className="read-only-pill">Read only</span>
      <div className="selection-summary" role="status">
        <span title={selection.ambiguous ? `Matches ${selection.ranges.length} entries in Source (duplicates)` : undefined}>
          {selection.ambiguous ? `Matches ${selection.ranges.length} entries in Source (duplicates)` : selection.refs.length
            ? selectionCountLabel(selection.refs.filter(r => r.kind === 'lattices.window').length) : 'Select windows in Preview'}
        </span>{selection.refs.length > 0 && <button type="button" onClick={() => model.selection.clear()}>Clear</button>}
      </div>
      <div className="header-actions"><button onClick={() => shell.current?.showPanel('source')}>Inspect Source</button><button onClick={() => shell.current?.setPanelLayout(expandedPreset())}>Expanded layout</button></div>
    </header>
    {data.error && <div className="notice" role="alert">Showing the last consistent view. {data.error} <button onClick={() => void model.retry()}>Retry</button></div>}
    {storageNotice && <div className="notice" role="status">Layout could not be saved on this device.</div>}
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
