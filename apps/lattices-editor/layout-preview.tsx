import {useState} from 'react';
import type { Projection, PreviewRow } from './model';
import { DisplayMap } from './display-map';
import { changeLabel,currentFrame,frameText,positionLabel,validFrame,type LayoutPreview } from './geometry';
export function LayoutPreviewView({projection,rows,name,preview,onBack,onSource}:{projection:Projection;rows:PreviewRow[];name:string;preview?:LayoutPreview;onBack:()=>void;onSource:()=>void}) {
 const [mode,setMode]=useState<'now'|'target'>('now');
 const hasTargets=!!preview?.frames.some(f=>validFrame(f.frame)&&rows.some(r=>r.windowId===f.windowId));
 const activeMode=hasTargets?mode:'now';
 return <section className="layout-preview-view"><button className="quiet-action" onClick={onBack}>‹ {name}</button><h1>Where {name} would go</h1><div className="preview-controls">{preview?.layout&&<code>Layout · {preview.layout}</code>}<div className="arrangement-toggle" role="group" aria-label="Arrangement preview"><button aria-pressed={activeMode==='now'} onClick={()=>setMode('now')}>Now</button><button aria-pressed={activeMode==='target'} disabled={!hasTargets} onClick={()=>setMode('target')}>Would go</button></div></div>
 <DisplayMap projection={projection} rows={rows} preview={preview} mode={activeMode} stage/>
 {!hasTargets&&<p className="preview-unavailable" role="status">Layout preview is unavailable for these windows. No eligible destinations were supplied.</p>}
 <h2>What would change{preview?.layout?` · layout ${preview.layout}`:''}</h2>
 <ul className="moves-list">{rows.map(row=>{const target=preview?.frames.find(f=>f.windowId===row.windowId)?.frame;const change=changeLabel(row,target);return <li key={row.id}><div className="move-window"><span className="overview-app-tile">{row.app.slice(0,1)}</span><span title={row.title}>{row.title||row.app}<small>{row.app}</small></span></div><div><span>{positionLabel(row)}: </span><code>{frameText(currentFrame(row))}</code><br/><span>Would go: </span><code>{target?frameText(target):'Unavailable'}</code></div>{change&&<span className={`move-tag ${change.toLowerCase()}`}>{change}</span>}</li>;})}</ul>
 <footer><p><svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect x="1.5" y="6" width="9" height="6" rx="1"/><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2"/></svg>Nothing moves. This version only reads.</p><div><button className="quiet-action" onClick={onSource}>Show source</button><button className="primary" onClick={onBack}>Done</button></div></footer></section>;
}
