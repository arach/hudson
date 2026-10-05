import {createActionGuard,equalNativeData} from './action-guard';
/** App-facing DTOs; the native adapter owns envelope parsing. */
export interface ActIntent {kind:'gather'|'open';layerId:string;entryIndex?:number}
export interface ActPlan extends ActIntent {planId:string;expiresAt:string;title:string;explanation:string;lines:string[];warnings:string[];shortcut?:string|null}
export interface ActResult {actionId:string;planId:string|null;layerId:string|null;ok:boolean;at:string;message:string;undoable:boolean;kind?:'gather'|'open'|'reveal'|'undo';counts?:Record<string,number>;reasons?:string[];undoOfActionId?:string}
export interface ActHistory {actionId:string;label:string;at:string;undoable:boolean;counts?:Record<string,number>}
export interface AssistantSnapshot {layerId:string;messages:{id:string;role:'user'|'assistant';text:string;readRules?:number;readWindows?:number}[];isSending:boolean;error:string|null;suggestions:(ActIntent&{label:string})[]}
export interface ActBackend {
 plan(intent:ActIntent):Promise<ActPlan>;
 confirm(planId:string):Promise<ActResult|null>;
 reveal():Promise<ActResult|null>;
 undo(actionId:string):Promise<ActResult|null>;
 list():Promise<{actions:ActHistory[];newestUndoableActionId:string|null}>;
 send(layerId:string,text:string):Promise<void>;
}
export function createActController(backend:ActBackend,onResult:()=>void=()=>{}) {
 const gate=createActionGuard(),listeners=new Set<()=>void>();let disposed=false,ticket=0,context='',historyGeneration=0;
 let state={plan:null as ActPlan|null,planning:false,busy:false,error:null as string|null,result:null as ActResult|null,history:[] as ActHistory[],newestUndoableActionId:null as string|null,assistant:{} as Record<string,AssistantSnapshot>};
 const emit=(patch:Partial<typeof state>)=>{if(disposed)return;const next={...state,...patch};if(equalNativeData(state,next))return;state=next;listeners.forEach(fn=>fn());};
 const seenResults=new Set<string>(),sending=new Set<string>();
 function receiveResult(result:ActResult){
  if(disposed)return;
  const fingerprint=result.actionId;if(seenResults.has(fingerprint))return;seenResults.add(fingerprint);if(seenResults.size>100)seenResults.delete(seenResults.values().next().value!);
  emit({result,busy:false,error:null,plan:null});onResult();
 }
 const fail=(error:unknown)=>emit({busy:false,planning:false,plan:null,error:error instanceof Error?error.message:'The request could not be completed.'});
 function cancel(){gate.cancel();emit({plan:null,planning:false});}
 return {
  getSnapshot:()=>state,
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  setContext(next:string){if(next===context)return;context=next;gate.context(next);emit({plan:null,planning:false});},
  cancel,
  async plan(intent:ActIntent){if(disposed||state.busy)return;ticket=gate.begin();const local=ticket;emit({planning:true,plan:null,error:null});try{const plan=await backend.plan(intent);if(gate.accepts(local))emit({plan,planning:false});}catch(error){if(gate.accepts(local))fail(error);}},
  async confirm(){const plan=state.plan;if(!plan||state.busy||disposed)return;if(Date.parse(plan.expiresAt)<=Date.now()){cancel();emit({error:'This plan expired. Review a new plan before confirming.'});return;}if(!gate.consume(ticket))return;emit({busy:true,plan:null,error:null});try{const result=await backend.confirm(plan.planId);if(result)receiveResult(result);}catch(error){fail(error);}},
  async reveal(){if(disposed||state.busy)return;cancel();emit({busy:true,error:null});try{const result=await backend.reveal();if(result)receiveResult(result);}catch(error){fail(error);}},
  async undo(){if(disposed||state.busy||!state.newestUndoableActionId)return;const id=state.newestUndoableActionId;historyGeneration++;cancel();emit({busy:true,error:null,newestUndoableActionId:null});try{const result=await backend.undo(id);if(result)receiveResult(result);}catch(error){fail(error);}},
  async list(){const generation=++historyGeneration;try{const data=await backend.list();if(generation===historyGeneration)emit({history:data.actions,newestUndoableActionId:data.newestUndoableActionId});}catch(error){if(generation===historyGeneration)emit({error:error instanceof Error?error.message:'Could not read recent actions.'});}},
  async send(layerId:string,text:string){if(disposed||!text.trim()||sending.has(layerId)||state.assistant[layerId]?.isSending)return false;sending.add(layerId);try{await backend.send(layerId,text.trim());return true;}catch(error){emit({error:error instanceof Error?error.message:'Could not send message.'});return false;}finally{sending.delete(layerId);}},
  receiveResult,
  receiveAssistant(data:AssistantSnapshot){if(equalNativeData(state.assistant[data.layerId],data))return;emit({assistant:{...state.assistant,[data.layerId]:data}});},
  dispose(){disposed=true;gate.cancel();listeners.clear();},
 };
}
