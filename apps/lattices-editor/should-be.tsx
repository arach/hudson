import { useState, type ReactNode, type CSSProperties } from 'react';
import type { Projection, PreviewRow } from './model';
import type { Frame } from './geometry';
import { overviewFacts } from './overview-data';
import { layoutStatus, notOpenTargets, placementWords, type AllTarget, type OpenTarget } from './should-be-data';

export function ShouldBe({projection,group,onSource,receipt,openEntry}:{receipt?:ReactNode;openEntry?:(index:number,app:string)=>ReactNode;projection:Projection;group:Projection['groups'][number];onSource:()=>void}) {
 const [tab,setTab]=useState<'should'|'now'>('should'),[all,setAll]=useState(false),[ghosts,setGhosts]=useState(true);
 const layout=group.layout, available=!!layout&&layout.kind!=='none', should=available&&tab==='should';
 const display=projection.displays?.find(d=>d.id===(layout?.displayId??projection.displays?.find(d=>d.main)?.id));
 const facts=overviewFacts(projection,group.id), missing=layout?notOpenTargets(layout):[];
 const includeAll=should&&all&&missing.length>0;
 const launchHint=(key:string)=>{const entry=projection.entries.find(e=>e.key===key);if(!entry)return null;try{const raw=JSON.parse(entry.canonical);if(raw.launch||raw.url||raw.path)return null;const match=raw.match??raw,app=raw.app??match.appEquals??match.app,title=match.title??match.titleContains??match.titleEquals;if(typeof app!=='string')return null;return 'No launch command: opens '+app+(typeof title==='string'?', not a '+JSON.stringify(title)+' window':'; a matching window is not guaranteed');}catch{return null;}};
 const rule=(key:string)=>facts.rules.find(r=>r.key===key);
 const live=group.rows.filter(r=>r.frameSource==='live'&&r.frame), noLive=group.rows.length-live.length;
 const rowFor=(t:OpenTarget)=>group.rows.find(r=>r.windowId===t.windowId);
 const members=(t:AllTarget)=>layout?.openTargets.filter(o=>o.entryIndex===t.entryIndex).flatMap(o=>{const r=rowFor(o);return r?[r]:[];})??[];
 const targets:AllTarget[]=layout?(includeAll?layout.allTargets:layout.openTargets):[];
 const frameStyle=(f:Frame):CSSProperties=>({left:`${(f.x-display!.frame.x)/display!.frame.w*100}%`,top:`${(f.y-display!.frame.y)/display!.frame.h*100}%`,width:`${f.w/display!.frame.w*100}%`,height:`${f.h/display!.frame.h*100}%`});
 const targetLabel=(t:AllTarget)=>{const rows='windowId' in t?[rowFor(t as OpenTarget)].filter((r):r is PreviewRow=>!!r):members(t);return {app:rows[0]?.app??rule(t.entryKey)?.app??'Rule',title:rows.map(r=>r.title||r.app).join(' · ')||'No window',rows};};
 const status=(t:AllTarget)=>'status' in t ? (t as OpenTarget).status==='wontMove'?(t as OpenTarget).reason:(t as OpenTarget).status==='moves'?'Moves':'Stays':members(t).length?'Open · reservation':'Not open';
 const tableTargets:AllTarget[]=layout?(includeAll?layout.allTargets:[...layout.openTargets,...missing]):[];
 return <>
 <section className="should-be-card"><header><h2>Layout</h2><code>{layout?`${layout.kind} · ${display?.main?'main display':display?.name??'display'}`:'Layout unavailable'}</code>{layout&&available&&<span className="layout-status">{layoutStatus(layout)}</span>}<div role="group" aria-label="Layout view" className="layout-tabs"><button disabled={!available} aria-pressed={should} onClick={()=>setTab('should')}>Should be</button><button aria-pressed={!should} onClick={()=>setTab('now')}>Now</button></div></header>{receipt}
 {display?<div className="should-be-stage">
 <div className="should-be-screen-wrap">
 {should&&layout&&<div className="lane-ruler" style={{marginLeft:`${(layout.visibleFrame.x-display.frame.x)/display.frame.w*100}%`,width:`${layout.visibleFrame.w/display.frame.w*100}%`}}>{layout.lanes[includeAll?'all':'open'].map((l,i)=><span key={i} style={{left:`${l.x*100}%`,width:`${l.w*100}%`}} title={l.label}>{l.label}<em>{Math.round(l.w*100)}%</em></span>)}</div>}
 {!should&&<div className="lane-ruler now-ruler">Where they are now</div>}
 <div className="should-be-screen" style={{aspectRatio:`${display.frame.w}/${display.frame.h}`}} aria-label={should?'Designed window positions':'Live window positions'}>
 {should?targets.filter(t=>t.frame&&t.displayId===display.id).map((t,i)=>{const label=targetLabel(t),empty=!label.rows.length;return <div key={i} className={`layout-window ${empty?'not-open':'lit'}`} style={frameStyle(t.frame!)} title={`${label.app} · ${label.title}`}><div className="window-bar"><i>{label.app[0]}</i>{label.app} · {label.title}</div><div className="window-body"><code>{rule(t.entryKey)?.text}</code><small>{status(t)}{t.ambiguous?' · duplicate entry':''}</small></div></div>;}):live.filter(r=>r.displayId===display.id).map(r=><div key={r.id} className="layout-window lit" style={frameStyle(r.frame!)} title={`${r.app} · ${r.title}`}><div className="window-bar"><i>{r.app[0]}</i>{r.app} · {r.title}</div></div>)}
 {should&&ghosts&&live.filter(r=>r.displayId===display.id).map(r=><div key={r.id} className="layout-window was" style={frameStyle(r.frame!)}><span>now</span></div>)}
 </div><div className="display-caption">{display.name} {display.frame.w.toLocaleString()}×{display.frame.h.toLocaleString()} · {display.main?'main':'display'}</div>
 </div><div className="other-displays">{projection.displays?.filter(d=>d.id!==display.id).map(d=><span key={d.id}>▱ {d.name}</span>)}<span>A switch leaves other displays alone.</span></div>
 </div>:<p className="geometry-unavailable">Display positions are unavailable.</p>}
 <footer>{!layout?<span>Layout information is unavailable. Showing live positions only.</span>:layout.kind==='none'?<span>This layer leaves windows where they are.</span>:<span>{includeAll?'One illustrative slot per entry; not a movement plan.':'A preview only. Nothing on your screen has moved.'}</span>}{should&&missing.length>0&&<label><input type="checkbox" checked={includeAll} onChange={e=>setAll(e.target.checked)}/>Include {missing.length} not open</label>}{should&&<label><input type="checkbox" checked={ghosts} onChange={e=>setGhosts(e.target.checked)}/>Show where they are now</label>}{!should&&noLive>0&&<span>{noLive} {noLive===1?'window has':'windows have'} no live position</span>}</footer>
 </section>
 {layout?<><table className="layout-rules"><thead><tr><th>Window / App</th><th className="rule-column">Rule</th><th>Should be</th><th>Status</th></tr></thead><tbody>{tableTargets.map((t,i)=>{const label=targetLabel(t),destination=projection.displays?.find(d=>d.id===t.displayId);return <tr key={i}><td><span className="overview-app-tile">{label.app[0]}</span><span title={label.title}>{label.title}<small>{label.app}</small></span></td><td className="rule-column"><code>{rule(t.entryKey)?.text??'Rule unavailable'}{t.ambiguous?' (duplicates)':''}</code></td><td>{placementWords(t.unitFrame)}{openEntry&&!label.rows.length&&<small className="launch-hint">{launchHint(t.entryKey)}</small>}{destination&&destination.id!==layout.displayId&&<small>{destination.name}</small>}</td><td><span className="layout-pill">{status(t)}</span>{!label.rows.length&&openEntry?.(t.entryIndex,label.app)}</td></tr>;})}</tbody></table>{layout.skipped.length>0&&<ul className="layout-skipped">{layout.skipped.map((s,i)=><li key={i}>Rule {s.entryIndex+1}: {s.reason}</li>)}</ul>}</>:<table className="layout-rules"><thead><tr><th>Window / App</th><th className="rule-column">Rule</th><th>Position</th></tr></thead><tbody>{group.rows.map(r=><tr key={r.id}><td>{r.title}<small>{r.app}</small></td><td className="rule-column"><code>{r.entryKeys.map(k=>rule(k)?.text).filter(Boolean).join(' · ')}</code></td><td>{r.frameSource==='live'?'Live position':'No live position'}</td></tr>)}{facts.rules.filter(r=>!r.open).map(r=><tr key={r.key}><td>No window<small>{r.app}</small></td><td className="rule-column"><code>{r.text}</code></td><td>Not open</td></tr>)}</tbody></table>}
 <div className="layout-source"><button className="quiet-action" onClick={onSource}>View in source ›</button></div>
 </>;
}
