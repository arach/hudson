import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DisplayMap } from './display-map';
import { LayoutPreviewView } from './layout-preview';
import { matchedEntry } from './geometry';
import type { Projection } from './model';
import { waitingRules, overviewSelectionFacts, toggleLayer, contextLabel } from './overview-data';
import { isUnassigned } from './flow';
import { createAgentComposer } from '../../packages/web/hudsonkit/src/agent-composer';
function LayerComposer({ label }: { label: string }) {
  const host=useRef<HTMLDivElement>(null), composer=useRef<ReturnType<typeof createAgentComposer>|null>(null);
  useLayoutEffect(()=>{ composer.current=createAgentComposer(host.current!, { minHeightPx:32, placeholder:'Ask about this layer…', ariaLabel:'Ask about this layer (unavailable)', onSubmit:()=>{} }); composer.current.header.append(composer.current.leadingTools); composer.current.header.hidden=false; return ()=>{composer.current?.destroy();composer.current=null;}; },[]);
  useLayoutEffect(()=>{composer.current?.update({disabled:true,canSend:false,contextItems:[{id:'layer',label}],status:'Answers arrive in a later version'});},[label]);
  return <div className="overview-composer" ref={host} />;
}
export function Overview({ projection, readAt, onOpen, selectedLayerIds, onSelectLayers }: { selectedLayerIds:string[]; onSelectLayers:(ids:string[])=>void; projection: Projection | null; readAt:number|null; onOpen:(panel?:'preview'|'source'|'history', ids?:string[], layerId?:string)=>void }) {
  const indexHost=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{const active=document.activeElement;if(active instanceof HTMLElement && indexHost.current?.contains(active) && active.getAttribute('aria-pressed')==='false') active.blur();},[selectedLayerIds]);
  const [now,setNow]=useState(Date.now);
  const [previewSelection,setPreviewSelection]=useState<string|null>(null);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const groups=projection?.groups ?? []; const layers=groups.filter(g=>!isUnassigned(g)); const unassigned=groups.find(isUnassigned);
  const single=selectedLayerIds.length===1 ? groups.find(g=>g.id===selectedLayerIds[0]) : undefined;
  const group=single ?? {id:'',label:selectedLayerIds.length ? `${selectedLayerIds.length} layers` : 'All windows',rows:groups.filter(g=>!selectedLayerIds.length||selectedLayerIds.includes(g.id)).flatMap(g=>g.rows)};
  if(!group || !projection) return <div className="overview-empty"><h1>No layers configured</h1><button onClick={()=>onOpen()}>Open Workspace ›</button></div>;
  const facts=overviewSelectionFacts(projection,selectedLayerIds); const index=layers.findIndex(g=>g.id===single?.id);
  const open=(panel?:'preview'|'source'|'history')=>onOpen(panel, facts.rows.map(r=>r.id), single?.id);
  const unassignedSelected=!!single&&isUnassigned(single);
  const waiting=waitingRules(facts.rules);
  const waitingCount=waiting.length;
  const displayCount=new Set(facts.rows.flatMap(r=>r.displayId?[r.displayId]:[])).size;
  const showingPreview=previewSelection===JSON.stringify(selectedLayerIds);
  const description=unassignedSelected ? `${facts.rows.length} open windows that no rule in workspace.json matches. They stay where they are; nothing here moves them.` : !facts.rows.length ? `${waitingCount} ${waitingCount===1?'rule is':'rules are'} waiting for a matching window.` : facts.description;
  const layerRow=(g:typeof group)=> <button key={g.id} aria-pressed={selectedLayerIds.includes(g.id)} onClick={e=>onSelectLayers(toggleLayer(selectedLayerIds,g.id,e.metaKey||e.ctrlKey))}><span className={isUnassigned(g)?"layer-dot unassigned-dot":"layer-dot"} data-open={!isUnassigned(g)&&!!g.rows.length}/><span>{g.label}</span><code>{isUnassigned(g)?g.rows.length:g.rows.length||'—'}</code></button>;
  return <div className="overview">
    <aside onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();open();return;}if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const buttons=Array.from(indexHost.current?.querySelectorAll<HTMLButtonElement>('button')??[]);const i=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=buttons[Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))];next?.click();next?.focus();}} ref={indexHost} className="layer-index" aria-label="Layers"><h2>Layers <span>{layers.length}</span></h2><button aria-pressed={!selectedLayerIds.length} onClick={()=>onSelectLayers([])}><span className="all-windows-glyph"/><span>All windows</span><code>{groups.reduce((n,g)=>n+g.rows.length,0)}</code></button><nav>{layers.map(layerRow)}</nav>{unassigned && <div className="unassigned-index">{layerRow(unassigned)}</div>}
      <footer><div className="index-key-hints">↑↓ move / ⏎ workspace</div><div>workspace.json</div>{readAt!==null && <div>Read {Math.max(0,Math.floor((now-readAt)/1000))}s ago</div>}</footer>
    </aside>
    <div className="overview-main">
      <div className="layer-picker"><span className="layer-dot" data-open={!!group.rows.length}/><select aria-label="Choose layer" value={single?.id ?? (selectedLayerIds.length ? '__multiple' : '')} onChange={e=>onSelectLayers(e.target.value ? [e.target.value] : [])}><option value="">All windows</option>{selectedLayerIds.length>1 && <option value="__multiple" disabled>{selectedLayerIds.length} layers selected</option>}{groups.map(g=><option value={g.id} key={g.id}>{g.label}</option>)}</select><span>⌄</span><code>{index>=0?`${index+1} of ${layers.length} · `:''}{facts.rows.length} open</code></div>
      <article className="layer-reading" hidden={showingPreview}><div className="overview-content">
        <div className="overview-hero"><div><div className="overview-eyebrow">{index>=0?`Layer · ${index+1} of ${layers.length}`:group.label}</div>
        <h1>{group.label}</h1><p className="layer-description">{description}</p>
        <div className={`layer-facts ${!facts.rows.length?'idle':''}`}><span><i className="layer-dot" data-open={!!facts.rows.length}/>{facts.rows.length?'Active':'Idle'}</span><span>{facts.rows.length} {facts.rows.length===1?'window':'windows'}</span>{!unassignedSelected&&<span>{facts.ruleCount} rules</span>}{displayCount>0&&<span>{displayCount} {displayCount===1?'display':'displays'}</span>}</div></div>
        </div>
        <section className="current-position-card"><header><h2>Where it is now</h2><div className="card-legend"><span className="legend-target"/>This layer<span className="legend-other"/>Other windows</div>{!unassignedSelected&&<button className="primary" disabled={!facts.rows.length} onClick={()=>setPreviewSelection(JSON.stringify(selectedLayerIds))}>Preview layout</button>}</header><DisplayMap projection={projection} rows={facts.rows} white={unassignedSelected}/>{!projection.displays?.length&&<p className="geometry-unavailable">Display positions are unavailable.</p>}</section>
        {facts.rows.length>0&&<table className="overview-window-table"><thead><tr><th aria-label="App icon"/><th>Window</th><th>App</th><th className={unassignedSelected?'where-column':'rule-column'}>{unassignedSelected?'Where':'Placed here by'}</th></tr></thead><tbody>{facts.rows.map(row=>{const entry=matchedEntry(projection,row);const rule=facts.rules.find(r=>r.key===entry?.key);const display=projection.displays?.find(d=>d.id===row.displayId);return <tr key={row.id}><td><span className="overview-app-tile">{row.app.slice(0,1)}</span></td><td title={row.title}>{row.title||row.app}</td><td>{row.app}</td><td className={unassignedSelected?'where-column':'rule-column'}>{unassignedSelected ? display ? <code>{display.name}</code> : null : rule ? <><span className="rule-chip"><code>{rule.text}</code></span><small className="rule-open-count">{rule.open} open</small></> : row.matchedRule===null&&row.entryKeys.length ? <span className="overview-muted">Multiple identical entries</span> : null}</td></tr>;})}</tbody></table>}
        {waiting.length>0&&<section className="waiting-rules"><h2>{!facts.rows.length?'Waiting · what would bring a window here':`Waiting · ${waitingCount} ${waitingCount===1?'rule matches':'rules match'} nothing open`}</h2><ul>{waiting.map(rule=><li key={rule.rowKey}><span className="waiting-ring"/><span>{rule.app??'Rule'}</span><code>{rule.text}</code><small>0 open</small></li>)}</ul></section>}
        <div className="overview-preview-strip"><p>{unassignedSelected?'These windows stay where they are.':`See where ${facts.rows.length===1?'this window':`these ${facts.rows.length} windows`} would go. Nothing moves: this version only reads.`}</p><div><button className="quiet-action" onClick={()=>open('source')}>{unassignedSelected?'Show source':'View in source ›'}</button></div></div>
        <div className="overview-add"><h2>Add to this page</h2><div>{(['preview','source','history'] as const).map(panel=><button key={panel} onClick={()=>open(panel)}>+ {panel[0].toUpperCase()+panel.slice(1)}</button>)}</div></div>
      </div><div className="overview-spacer"/><section className={`overview-chat ${!facts.rows.length?'empty-layer':''}`}><div><h2>{single ? 'Chat about this layer' : 'Chat about these windows'}</h2><button className="quiet-action" onClick={()=>open()}>Open Workspace ›</button></div><LayerComposer label={single ? contextLabel(group.label,facts.rows) : `${group.label} · ${facts.rows.length} ${facts.rows.length===1?'window':'windows'}`}/></section>
      </article>{showingPreview&&<LayoutPreviewView projection={projection} rows={facts.rows} name={group.label} preview={single?.preview} onBack={()=>setPreviewSelection(null)} onSource={()=>open('source')}/>}
    </div>
  </div>;
}
