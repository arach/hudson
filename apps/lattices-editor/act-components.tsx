import {useLayoutEffect,useRef} from 'react';
import {HudPopover} from '../../packages/web/hudsonkit/src/components/behaviors/HudPopover';
import {createAgentComposer} from '../../packages/web/hudsonkit/src/agent-composer';

/** Presentation-only props. No component interprets assistant prose as commands. */
export interface ConfirmationView { title:string; explanation:string; lines:string[]; warnings:string[]; confirmLabel?:string;kind?:'gather'|'open' }
export function ActTrigger({label,primary=false,busy=false,disabled=false,confirmation,onPlan,onCancel,onConfirm}:{label:string;primary?:boolean;busy?:boolean;disabled?:boolean;confirmation:ConfirmationView|null;onPlan:()=>void;onCancel:()=>void;onConfirm:()=>void}) {
 return <HudPopover open={!!confirmation} onOpenChange={open=>{if(!open)onCancel();}} align="end" side="bottom" modal="trap-focus" className="lv action-confirm" title={confirmation?.title} content={confirmation&&<><p>{confirmation.explanation}</p><ul>{confirmation.lines.map((line,i)=><li key={i}>{line}</li>)}</ul>{confirmation.warnings.map((line,i)=><p className="confirmation-note" key={i}>{line}</p>)}<div className="confirm-buttons"><button onClick={onCancel}>Cancel</button><button className="primary" disabled={busy} onClick={onConfirm}>{busy?'Working…':(confirmation.confirmLabel??(confirmation.kind==='open'?'Open':'Gather'))}</button></div></>}><button className={primary?'primary':'act-quiet'} disabled={disabled||busy} onClick={onPlan}>{busy?'Working…':label}</button></HudPopover>;
}
export interface ChatMessageView { id:string;role:'user'|'assistant';text:string;readRules?:number;readWindows?:number }
export interface SuggestionView { id:string;label:string;onPlan:()=>void }
export function LayerChat({context,messages,suggestions,isSending,available,error,onSend}:{context:string;messages:ChatMessageView[];suggestions:SuggestionView[];isSending:boolean;available:boolean;error:string|null;onSend:(text:string)=>Promise<boolean>}) {
 const host=useRef<HTMLDivElement>(null),composer=useRef<ReturnType<typeof createAgentComposer>|null>(null),send=useRef(onSend);
 useLayoutEffect(()=>{send.current=onSend;},[onSend]);
 useLayoutEffect(()=>{
  const instance=createAgentComposer(host.current!,{minHeightPx:32,maxHeightPx:120,sendOnEnter:false,placeholder:'Ask why a window is here, or tell it to gather…',ariaLabel:'Message about this layer',onSubmit:(_action,text)=>{void send.current(text).then(accepted=>{if(accepted&&instance.textarea.value===text)instance.update({value:''});});}});
  composer.current=instance;instance.header.append(instance.leadingTools);instance.header.hidden=false;
  return()=>{instance.destroy();composer.current=null;};
 },[]);
 useLayoutEffect(()=>{composer.current?.update({disabled:!available,sending:isSending,contextItems:[{id:'layer',label:context}],status:available?'⌘↩ send · answers can move windows only after you confirm':'Assistant unavailable in this version'});},[context,available,isSending]);
 return <><div className="layer-messages" role="log" aria-label="Layer conversation">{messages.map(message=><div key={message.id} className={`layer-message ${message.role}`}>{message.role==='assistant'&&<span className="assistant-avatar">L</span>}<div>{message.role==='assistant'&&<small>Assistant{message.readRules!==undefined&&message.readWindows!==undefined?` · read ${message.readRules} rules, ${message.readWindows} windows`:''}</small>}<p>{message.text}</p></div></div>)}{suggestions.length>0&&<div className="assistant-suggestions">{suggestions.map(s=><button key={s.id} disabled={isSending} onClick={s.onPlan}>{s.label}</button>)}</div>}{isSending&&<p className="assistant-typing" role="status">Thinking…</p>}{error&&<p className="assistant-error" role="status">{error}</p>}</div><div ref={host} className="overview-composer live-composer"/></>;
}
