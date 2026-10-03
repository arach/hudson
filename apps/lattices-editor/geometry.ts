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
