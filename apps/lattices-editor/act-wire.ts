import type {HostBridge} from '../../packages/web/hudsonkit/src/editor/host-bridge';
import {createActController,type ActIntent,type ActResult,type ActHistory,type AssistantSnapshot} from './act-controller';
export interface NativePlan {planId:string;kind:'gather'|'open';layerId:string;layerName:string;expiresAt:string;layoutCount:number;putAwayCount:number|null;displaysLeftAlone:{id:string;name:string}[];entries:{entryIndex:number;entryKey:string;app:string|null;method:'url'|'app'|'command';value:string;description:string;cwd?:string}[];explanation:string;shortcut:string|null;warnings:string[]}
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const strings=(x:unknown):x is string[]=>Array.isArray(x)&&x.every(v=>typeof v==='string');
export function parsePlan(x:unknown,intent:ActIntent):NativePlan {
 if(!object(x)||typeof x.planId!=='string'||x.kind!==intent.kind||x.layerId!==intent.layerId||typeof x.layerName!=='string'||typeof x.expiresAt!=='string'||!Number.isFinite(Date.parse(x.expiresAt))||typeof x.explanation!=='string'||!(x.shortcut===null||typeof x.shortcut==='string')||!Number.isInteger(x.layoutCount)||!(x.putAwayCount===null||Number.isInteger(x.putAwayCount))||!strings(x.warnings)||!Array.isArray(x.displaysLeftAlone)||x.displaysLeftAlone.some(d=>!object(d)||typeof d.id!=='string'||typeof d.name!=='string')||!Array.isArray(x.entries)||x.entries.some(e=>!object(e)||!Number.isInteger(e.entryIndex)||typeof e.entryKey!=='string'||typeof e.description!=='string'||!['url','app','command'].includes(String(e.method))||typeof e.value!=='string'))throw Error('The host returned an invalid confirmation plan.');
 return x as unknown as NativePlan;
}
export function parseResult(x:unknown):ActResult {
 if(!object(x)||typeof x.actionId!=='string'||!(x.planId===null||typeof x.planId==='string')||!(x.layerId===null||typeof x.layerId==='string')||!['gather','open','reveal','undo'].includes(String(x.kind))||typeof x.ok!=='boolean'||typeof x.undoable!=='boolean'||typeof x.at!=='string'||!Number.isFinite(Date.parse(x.at))||typeof x.message!=='string'||!object(x.counts)||Object.values(x.counts).some(v=>typeof v!=='number'||!Number.isFinite(v))||x.reasons!==undefined&&!strings(x.reasons))throw Error('The host returned an invalid action receipt.');
 return x as unknown as ActResult;
}
export function parseAssistant(x:unknown):AssistantSnapshot|null {
 if(!object(x)||!(x.layerId===null||typeof x.layerId==='string')||!Array.isArray(x.messages)||typeof x.isSending!=='boolean'||!(x.error===null||typeof x.error==='string')||!Array.isArray(x.suggestions)||x.messages.some(m=>!object(m)||typeof m.id!=='string'||typeof m.text!=='string'||!['system','user','assistant'].includes(String(m.role)))||x.suggestions.some(s=>!object(s)||typeof s.label!=='string'||typeof s.layerId!=='string'||!['gather','open'].includes(String(s.kind))||s.entryIndex!==undefined&&(!Number.isInteger(s.entryIndex)||(s.entryIndex as number)<0)))throw Error('The host returned an invalid conversation.');
 if(x.layerId===null)return null;
 return {...x,messages:x.messages.filter(m=>m.role!=='system')} as unknown as AssistantSnapshot;
}
export function createActClient(bridge:HostBridge,context:()=>{subjectId:string|null;revision:string|null},refresh:()=>void) {
 let methods:string[]=[],disposed=false;const assistantGenerations=new Map<string,number>();
 const supported=(name:string)=>methods.includes(name);
 async function request(name:string,payload:object={}){if(!supported(name))throw Error('This action is unavailable in this Lattices version.');const c=context();if(!c.subjectId)throw Error('Workspace is not ready.');return (await bridge.request(name,c.subjectId,c.revision,payload)).payload;}
 const controller=createActController({
  async plan(intent){const plan=parsePlan(await request('action.plan',intent),intent);const lines=plan.kind==='gather'?[`Lays out ${plan.layoutCount} windows`,...(plan.putAwayCount===null?[]:[`Puts away ${plan.putAwayCount} windows`]),`Leaves ${plan.displaysLeftAlone.length} displays alone${plan.displaysLeftAlone.length?' · '+plan.displaysLeftAlone.map(d=>d.name).join(', '):''}`]:plan.entries.map(e=>e.description);
   return {...plan,title:`${plan.kind==='gather'?'Gather':'Open missing windows for'} ${plan.layerName}?`,lines,warnings:[...plan.warnings,...(plan.kind==='gather'?['Show all windows puts everything back.']:[])]};},
  async confirm(planId){return parseResult(await request('action.confirm',{planId}));},
  async reveal(){return parseResult(await request('action.reveal'));},
  async undo(actionId){return parseResult(await request('action.undo',{actionId}));},
  async list(){const x=await request('actions.list');if(!object(x)||!Array.isArray(x.actions)||!(x.newestUndoableActionId===null||typeof x.newestUndoableActionId==='string')||x.actions.some(a=>!object(a)||typeof a.actionId!=='string'||typeof a.label!=='string'||typeof a.at!=='string'||typeof a.undoable!=='boolean'))throw Error('Could not read recent actions.');return {actions:x.actions as ActHistory[],newestUndoableActionId:supported('action.undo')?x.newestUndoableActionId:null};},
  async send(layerId,text){await request('assistant.send',{layerId,text});await readAssistant(layerId);},
 },()=>{refresh();if(supported('actions.list'))void controller.list();});
 async function readAssistant(layerId:string){if(!supported('assistant.state'))return;const generation=(assistantGenerations.get(layerId)??0)+1;assistantGenerations.set(layerId,generation);try{const value=parseAssistant(await request('assistant.state',{layerId}));if(!disposed&&assistantGenerations.get(layerId)===generation&&value?.layerId===layerId)controller.receiveAssistant(value);}catch(error){if(!disposed&&assistantGenerations.get(layerId)===generation)controller.receiveAssistant({layerId,messages:controller.getSnapshot().assistant[layerId]?.messages??[],isSending:false,suggestions:[],error:error instanceof Error?error.message:'Could not read conversation.'});}}
 const unsubscribe=bridge.subscribe(event=>{if(event.subjectId!==context().subjectId)return;try{if(event.kind==='action.result'&&supported('action.plan'))controller.receiveResult(parseResult(event.payload));if(event.kind==='assistant.state'&&supported('assistant.state')){const value=parseAssistant(event.payload);if(value){assistantGenerations.set(value.layerId,(assistantGenerations.get(value.layerId)??0)+1);controller.receiveAssistant(value);}}}catch{/* Malformed unsolicited events never authorize effects. */}});
 return {controller,supported,readAssistant,setMethods(next:string[]){methods=next;},dispose(){disposed=true;unsubscribe();controller.dispose();}};
}
export type ActClient=ReturnType<typeof createActClient>;
