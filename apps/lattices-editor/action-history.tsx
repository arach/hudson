import {useEffect,useState,type RefObject} from 'react';
import type {ActHistory,ActResult} from './act-controller';

/** Keep text editors' own undo intact, including CodeMirror and future inputs. */
export function isPageUndo(event:Pick<KeyboardEvent,'key'|'metaKey'|'ctrlKey'|'shiftKey'|'altKey'|'defaultPrevented'|'target'>) {
 if(event.defaultPrevented||!event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.key.toLowerCase()!=='z')return false;
 const target=event.target;
 return !(target instanceof Element&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.cm-editor,.live-composer'));
}
export function usePageUndo(root:RefObject<HTMLElement|null>,enabled:boolean,onUndo:()=>void) {
 useEffect(()=>{
  if(!enabled)return;
  const key=(event:KeyboardEvent)=>{
   const page=root.current?.closest<HTMLElement>('.editor-root')??root.current;
   if(!page||page.closest('[hidden]')||document.visibilityState==='hidden'||!page.getClientRects().length||!isPageUndo(event))return;
   event.preventDefault();onUndo();
  };
  document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
 },[root,enabled,onUndo]);
}
export function ActionReceipt({result,error,history,newestUndoableActionId,busy,onUndo,onReveal,onDetails}:{result:ActResult|null;error:string|null;history:ActHistory[];newestUndoableActionId:string|null;busy:boolean;onUndo:()=>void;onReveal:()=>void;onDetails:()=>Promise<void>}) {
 const [details,setDetails]=useState(false),[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 if(!result&&!error)return null;
 const recent=result&&now-Date.parse(result.at)<60000;
 return <><div className="action-receipt" role="status"><span>{error??result?.message}{!error&&result&&<small title={result.at}> · {recent?'just now':new Date(result.at).toLocaleTimeString()}</small>}</span>{newestUndoableActionId&&<button disabled={busy} onClick={onUndo}>{newestUndoableActionId===result?.actionId?'Undo':'Undo latest'}</button>}<button disabled={busy} onClick={onReveal}>Show all windows</button><button aria-expanded={details} onClick={()=>{setDetails(!details);if(!details)void onDetails();}}>Details</button></div>{details&&<section className="action-history" aria-label="Recent actions"><h3>Recent actions</h3>{history.length===0?<p>No recent actions.</p>:<ol>{history.map(item=><li key={item.actionId}><span>{item.label}<small title={item.at}>{new Date(item.at).toLocaleTimeString()}{item.counts&&Object.entries(item.counts).map(([key,value])=>` · ${key}: ${value}`).join('')}</small></span>{item.actionId===newestUndoableActionId&&item.undoable&&<button disabled={busy} onClick={onUndo}>Undo</button>}</li>)}</ol>}</section>}</>;
}
