import { validFrame, type Frame } from './geometry';
export interface LayoutLane { x:number; w:number; label:string }
interface Target { entryIndex:number; entryKey:string; unitFrame?:Frame|null; frame?:Frame|null; displayId:string|null; ambiguous?:boolean }
export interface OpenTarget extends Target { windowId:number; status:'moves'|'stays'|'wontMove'; reason?:string }
export type AllTarget = Target;
export interface ShouldBeLayout { kind:'auto'|'columns'|'master-stack'|'none'; displayId:string; visibleFrame:Frame; lanes:{open:LayoutLane[];all:LayoutLane[]}; openTargets:OpenTarget[];allTargets:AllTarget[];skipped:{entryIndex:number;entryKey?:string;reason:string}[] }
export function placementWords(f:Frame|null|undefined) {
 if(!f)return 'Position unavailable';
 const near=(a:number,b:number)=>Math.abs(a-b)<.015;
 const width=near(f.w,1)?'full width':`${near(f.x,0)?'left':near(f.x+f.w,1)?'right':'middle'} ${near(f.w,.5)?'half':`${Math.round(f.w*100)}%`}`;
 const vertical=near(f.h,1)?'':near(f.y,0)?', top':near(f.y+f.h,1)?', bottom':', middle';return width+vertical;
}
export function notOpenTargets(layout:ShouldBeLayout) {const open=new Set(layout.openTargets.map(t=>t.entryIndex));return layout.allTargets.filter(t=>!open.has(t.entryIndex));}
export function layoutStatus(layout:ShouldBeLayout) { const moves=layout.openTargets.filter(t=>t.status==='moves').length, held=layout.openTargets.filter(t=>t.status==='wontMove').length;return moves ? `${moves} of ${layout.openTargets.length} out of place${held?` · ${held} won't move`:''}` : held ? `${held} won't move` : layout.openTargets.length ? 'In place' : 'No open windows'; }
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function validLayout(x:unknown):x is ShouldBeLayout {
 if(!obj(x)||!['auto','columns','master-stack','none'].includes(String(x.kind))||typeof x.displayId!=='string'||!validFrame(x.visibleFrame)||!obj(x.lanes))return false;
 for(const key of ['open','all']){const lanes=x.lanes[key];if(!Array.isArray(lanes)||lanes.some(l=>!obj(l)||!Number.isFinite(l.x)||!Number.isFinite(l.w)||(l.w as number)<=0||typeof l.label!=='string'))return false;}
 for(const key of ['openTargets','allTargets']){const targets=x[key];if(!Array.isArray(targets)||targets.some(t=>!obj(t)||!Number.isInteger(t.entryIndex)||(t.entryIndex as number)<0||typeof t.entryKey!=='string'||!(t.displayId===null||typeof t.displayId==='string')||t.frame!=null&&!validFrame(t.frame)||t.unitFrame!=null&&!validFrame(t.unitFrame)||t.ambiguous!==undefined&&typeof t.ambiguous!=='boolean'||key==='openTargets'&&(!Number.isInteger(t.windowId)||!['moves','stays','wontMove'].includes(String(t.status))||t.status==='wontMove'&&(typeof t.reason!=='string'||!t.reason.trim()))))return false;}
 return Array.isArray(x.skipped)&&x.skipped.every(s=>obj(s)&&Number.isInteger(s.entryIndex)&&typeof s.reason==='string');
}
