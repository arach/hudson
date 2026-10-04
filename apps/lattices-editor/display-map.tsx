import {useId} from 'react';
import type { Projection, PreviewRow } from './model';
import {currentFrame,displayScene,equalFrames,intersects,validFrame,positionLabel,type LayoutPreview} from './geometry';
export function DisplayMap({projection,rows,preview,white=false,stage=false,mode='now'}:{projection:Projection;rows:PreviewRow[];preview?:LayoutPreview;white?:boolean;stage?:boolean;mode?:'now'|'target'}) {
 const id=useId().replaceAll(':',''),width=820,height=210;
 const scene=displayScene(projection.displays??[],width,height);
 if(!scene.length)return null;
 const selected=new Set(rows.map(r=>r.windowId));
 const all=[...new Map(projection.groups.flatMap(g=>g.rows).map(r=>[r.windowId,r])).values()];
 const unavailableLive=rows.filter(row=>row.frameSource!=='live'||!currentFrame(row)).length;
 const targets=mode==='target'?(preview?.frames.filter(f=>validFrame(f.frame))??[]):[];
 return <figure className={stage?'layout-stage':'display-map'} data-mode={mode}><svg role="img" aria-label={mode==='target'?'Read-only proposed window arrangement':'Display and window positions'} viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
 <defs><linearGradient id={`${id}-glass`} x2="0" y2="1"><stop stopColor="#233239"/><stop offset="1" stopColor="#11191d"/></linearGradient><linearGradient id={`${id}-reflection`} x2="1" y2="1"><stop stopColor="white" stopOpacity=".07"/><stop offset=".55" stopColor="white" stopOpacity="0"/></linearGradient><linearGradient id={`${id}-lit`} x2="0" y2="1"><stop stopColor="var(--em)" stopOpacity=".38"/><stop offset="1" stopColor="var(--em-deep)" stopOpacity=".1"/></linearGradient><filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter><filter id={`${id}-floor`} x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter></defs>
 {scene.map(({display:d,x,y,w,h,scale})=>{const clip=`${id}-${d.id.replace(/[^a-z0-9]/gi,'_')}`;
 const rect=(f:{x:number;y:number;w:number;h:number})=>({x:x+(f.x-d.frame.x)*scale,y:y+(f.y-d.frame.y)*scale,width:f.w*scale,height:f.h*scale});
 return <g key={d.id} data-display-id={d.id}>
 <ellipse className="display-floor" cx={x+w/2} cy={y+h+12} rx={w*.58} ry="5" filter={`url(#${id}-floor)`}/>
 <rect className={`display-bezel ${d.main?'main-display':''}`} x={x-5} y={y-5} width={w+10} height={h+10} rx="5"/>
 <rect className="display-glass" x={x} y={y} width={w} height={h} rx="2" fill={`url(#${id}-glass)`}/><clipPath id={clip}><rect x={x} y={y} width={w} height={h} rx="2"/></clipPath>
 <g clipPath={`url(#${clip})`}>
 {all.map(row=>{const f=currentFrame(row);if(row.frameSource!=='live'||!f||!intersects(f,d.frame))return null;const picked=selected.has(row.windowId),target=targets.find(t=>t.windowId===row.windowId)?.frame;
 const dashed=mode==='target'&&picked&&row.frameSource==='live'&&target&&!equalFrames(f,target);
 if(mode==='target'&&picked&&target&&!dashed)return null;
 const lit=picked&&mode==='now';return <g key={row.windowId}>{lit&&!white&&<rect {...rect(f)} fill="var(--em)" opacity=".2" filter={`url(#${id}-glow)`}/>}<rect {...rect(f)} className={dashed?'window-now':lit?white?'window-white':'window-current':'window-ghost'} style={lit&&!white?{'--window-fill':`url(#${id}-lit)`} as React.CSSProperties:undefined} fill={lit&&!white?`url(#${id}-lit)`:undefined} rx="2"><title>{row.app} — {row.title} · {positionLabel(row)}</title></rect></g>;})}
 {targets.map(t=>{const row=rows.find(r=>r.windowId===t.windowId);if(!row||!intersects(t.frame,d.frame))return null;const r=rect(t.frame);return <g key={t.windowId}><rect {...r} fill="var(--em)" opacity=".15" filter={`url(#${id}-glow)`}/><rect {...r} className="window-proposed" style={{'--window-fill':`url(#${id}-lit)`} as React.CSSProperties} fill={`url(#${id}-lit)`} rx="2"/><title>{row.app} — {row.title}</title>{r.width>25&&r.height>25&&<text className="window-map-title" x={r.x+4} y={r.y+12} fontSize="7">{row.app.slice(0,1)} {row.title.slice(0,Math.max(1,Math.floor(r.width/4)-5))}</text>}</g>;})}
 <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-reflection)`} pointerEvents="none"/>
 </g><text className="display-name" x={x+w/2} y={y+h+24} textAnchor="middle" fontSize="8">{d.name}{d.main?' · main':''}</text>
 </g>;})}
 </svg><figcaption>Displays to scale · {scene.length} {scene.length===1?'display':'displays'}{unavailableLive?` · ${unavailableLive} without live positions`:null}</figcaption></figure>;
}
