import type { Projection, PreviewRow } from './model';
export interface Frame { x:number; y:number; w:number; h:number }
export interface Display { id:string; name:string; main:boolean; frame:Frame }
export interface LayoutPreview { layout:string; displayId:string; frames:{windowId:number;frame:Frame}[] }
export function validFrame(f:unknown): f is Frame { if(!f || typeof f!=='object')return false;const r=f as Frame;return [r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0; }
export function currentFrame(row:PreviewRow) { return row.frameSource!=='unavailable'&&validFrame(row.frame)?row.frame:undefined; }
export function positionLabel(row:PreviewRow) { return row.frameSource ? ({live:'Now',lastKnown:'Last known',savedHome:'Saved position',unavailable:'Unavailable'} as const)[row.frameSource] : 'Position'; }
export function equalFrames(a:Frame,b:Frame) {return a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;}
export function changeLabel(row:PreviewRow, target?:Frame) { const frame=currentFrame(row);return frame&&row.frameSource==='live'&&target ? equalFrames(frame,target)?'Stays':'Moves':null; }
export function frameText(f?:Frame) {return f ? `${Math.round(f.x)}, ${Math.round(f.y)} · ${Math.round(f.w)} × ${Math.round(f.h)}` : 'Position unavailable';}
export function displayBounds(displays:Display[]) {if(!displays.length)return null;const x=Math.min(...displays.map(d=>d.frame.x)),y=Math.min(...displays.map(d=>d.frame.y));return {x,y,w:Math.max(...displays.map(d=>d.frame.x+d.frame.w))-x,h:Math.max(...displays.map(d=>d.frame.y+d.frame.h))-y};}
export function matchedEntry(p:Projection,row:PreviewRow) {
 if(row.matchedRule===null||row.matchedRule===undefined)return undefined;
 return p.entries.filter(e=>e.layerId===row.layerId).flatMap(entry=>entry.ranges.map(range=>({entry,from:range.from}))).sort((a,b)=>a.from-b.from)[row.matchedRule]?.entry;
}

/** Display illustration: preserve physical scale, align bottoms, never alter host frames. */
export function displayScene(displays:Display[],width=820,height=210) {
 const ordered=displays.filter(d=>validFrame(d.frame)).sort((a,b)=>a.frame.x-b.frame.x||a.frame.y-b.frame.y);
 if(!ordered.length)return [];
 const gap=24,scale=Math.min(.078,(width-40-gap*(ordered.length-1))/ordered.reduce((n,d)=>n+d.frame.w,0),(height-48)/Math.max(...ordered.map(d=>d.frame.h)));
 if(scale<=0)return [];
 const total=ordered.reduce((n,d)=>n+d.frame.w*scale,0)+gap*(ordered.length-1);
 let x=(width-total)/2;const bottom=height-30;
 return ordered.map(display=>{const item={display,x,y:bottom-display.frame.h*scale,w:display.frame.w*scale,h:display.frame.h*scale,scale};x+=item.w+gap;return item;});
}
export function intersects(a:Frame,b:Frame) {return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
