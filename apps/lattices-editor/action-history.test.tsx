import {expect,test} from 'bun:test';
import {createActController,type ActBackend} from './act-controller';
import {isPageUndo} from './action-history';
test('Undo targets only the native newest ID, not an older receipt',async()=>{
 const calls:string[]=[];const backend:ActBackend={plan:async()=>{throw Error('unused');},confirm:async()=>null,reveal:async()=>null,send:async()=>{},list:async()=>({actions:[{actionId:'new',label:'Gather',at:'2026-10-03',undoable:true},{actionId:'old',label:'Open',at:'2026-10-02',undoable:true}],newestUndoableActionId:'new'}),undo:async id=>{calls.push(id);return {actionId:'undo',planId:null,layerId:'a',ok:true,at:'2026-10-03',message:'Undid gather · restored 9, skipped 1 (you moved Ghostty since)',undoable:false};}};
 const c=createActController(backend);await c.undo();expect(calls).toEqual([]);await c.list();expect(calls).toEqual([]);await c.undo();expect(calls).toEqual(['new']);await c.undo();expect(calls).toEqual(['new']);expect(c.getSnapshot().result?.message).toContain('skipped 1');
});
test('page Undo preserves text editing and modified shortcut variants',async()=>{
 const {JSDOM}=await import('jsdom');const {window}=new JSDOM('<body></body>');const old=globalThis.Element;
 Object.defineProperty(globalThis,'Element',{value:window.Element,configurable:true,writable:true});
 try {const event={key:'z',metaKey:true,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false,target:window.document.body as unknown as EventTarget};
 expect(isPageUndo(event)).toBe(true);
 for(const tag of ['textarea','input','select'])expect(isPageUndo({...event,target:window.document.createElement(tag) as unknown as EventTarget})).toBe(false);
 const editable=window.document.createElement('div');editable.setAttribute('contenteditable','true');expect(isPageUndo({...event,target:editable as unknown as EventTarget})).toBe(false);
 expect(isPageUndo({...event,shiftKey:true})).toBe(false);expect(isPageUndo({...event,defaultPrevented:true})).toBe(false);
 }finally {Object.defineProperty(globalThis,'Element',{value:old,configurable:true,writable:true});window.close();}
});
