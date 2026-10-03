import type { Projection, PreviewRow } from './model';
import { currentFrame, displayBounds, equalFrames, validFrame, positionLabel, type LayoutPreview } from './geometry';
export function DisplayMap({projection,rows,preview,white=false,stage=false}:{projection:Projection;rows:PreviewRow[];preview?:LayoutPreview;white?:boolean;stage?:boolean}) {
 const displays=(projection.displays??[]).filter(d=>validFrame(d.frame));const bounds=displayBounds(displays);
 if(!bounds || (stage&&!preview?.frames.length))return null;
 const width=stage?820:236,height=stage?270:112;
 const scale=Math.min(width/bounds.w,height/bounds.h),pad=12/scale;
 const selected=new Set(rows.map(r=>r.windowId));
 const all=[...new Map(projection.groups.flatMap(g=>g.rows).map(r=>[r.windowId,r])).values()];
 const targets=preview?.frames.filter(f=>validFrame(f.frame))??[];
 return <figure className={stage?'layout-stage':'display-map'}><svg role="img" aria-label={stage?'Read-only proposed window arrangement':'Display and window positions'} viewBox={`${bounds.x-pad} ${bounds.y-pad} ${bounds.w+pad*2} ${bounds.h+pad*2}`} width={width} height={height}>
 {displays.map(d=><g key={d.id}><rect className="display-outline" x={d.frame.x} y={d.frame.y} width={d.frame.w} height={d.frame.h} rx={3/scale}/>{stage&&<text className="display-name" x={d.frame.x+12/scale} y={d.frame.y+18/scale} fontSize={10/scale}>{d.name}{d.main?' · main':''}</text>}</g>)}
 {all.map(row=>{const f=currentFrame(row);if(!f)return null;const picked=selected.has(row.windowId);const target=targets.find(t=>t.windowId===row.windowId)?.frame;
 const dashed=stage&&picked&&row.frameSource==='live'&&target&&!equalFrames(f,target);
 if(stage&&picked&&target&&!dashed)return null;
 return <rect key={row.windowId} className={dashed?'window-now':picked&&!stage?white?'window-white':'window-current':'window-ghost'} x={f.x} y={f.y} width={f.w} height={f.h} rx={2/scale}><title>{row.app} — {row.title} · {positionLabel(row)}</title></rect>;})}
 {stage&&targets.map(t=>{const row=rows.find(r=>r.windowId===t.windowId);if(!row)return null;return <g key={t.windowId}><rect className="window-proposed" x={t.frame.x} y={t.frame.y} width={t.frame.w} height={t.frame.h} rx={3/scale}/><rect className="map-app-tile" x={t.frame.x+6/scale} y={t.frame.y+8/scale} width={14/scale} height={14/scale} rx={3/scale}/><text className="window-map-title" x={t.frame.x+10/scale} y={t.frame.y+18/scale} fontSize={9/scale}>{row.app.slice(0,1)}</text><text className="window-map-title" x={t.frame.x+6/scale} y={t.frame.y+36/scale} fontSize={9/scale}>{row.title.slice(0,Math.max(2,Math.floor(t.frame.w*scale/5.5)-3))}</text><title>{row.app} — {row.title}</title></g>;})}
 </svg>{!stage&&<figcaption>{displays.map(d=>`${d.name}${d.main?' · main':''}`).join(' · ')}</figcaption>}</figure>;
}
