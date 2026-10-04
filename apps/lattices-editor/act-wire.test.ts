import {expect,test} from 'bun:test';
import {createMockTransport} from './mock';
import {createHostBridge} from '../../packages/web/hudsonkit/src/editor/host-bridge';
import {createEditorModel} from './model';
import {parsePlan,parseResult} from './act-wire';
test('frozen Act model is passive on discovery, select, view and chat replies',async()=>{
 const mock=createMockTransport({act:true,pass2:true,chrome:'host',selectedLayerIds:['lattices']}),model=createEditorModel(createHostBridge(mock.transport));await model.start();
 model.setSelectedLayers(['fab']);model.setView('workspace');model.setView('overview');model.setSelectedLayers(['lattices']);await model.actions.readAssistant('lattices');await model.actions.controller.list();
 expect(mock.calls.filter(k=>['action.plan','action.confirm','action.undo','action.reveal'].includes(k))).toEqual([]);
 await model.actions.controller.send('lattices','Why?');await new Promise(r=>setTimeout(r,100));expect(mock.calls.includes('action.plan')).toBe(false);expect(model.actions.controller.getSnapshot().assistant.lattices.suggestions.length).toBe(2);model.dispose();
});
test('reply plus action event publishes one receipt, refreshes history, and Undo is single-use',async()=>{
 const mock=createMockTransport({act:true,pass2:true}),model=createEditorModel(createHostBridge(mock.transport));await model.start();let receipts=0,last='';model.actions.controller.subscribe(()=>{const id=model.actions.controller.getSnapshot().result?.actionId;if(id&&id!==last){last=id;receipts++;}});
 await model.actions.controller.plan({kind:'gather',layerId:'lattices'});expect(mock.calls.includes('action.confirm')).toBe(false);await model.actions.controller.confirm();await model.actions.controller.list();expect(receipts).toBe(1);expect(model.actions.controller.getSnapshot().newestUndoableActionId).not.toBeNull();await model.actions.controller.undo();await model.actions.controller.list();expect(receipts).toBe(2);expect(model.actions.controller.getSnapshot().result?.message).toContain('skipped 1');expect(model.actions.controller.getSnapshot().newestUndoableActionId).toBeNull();model.dispose();
});
test('Undo unavailable without capability even if history returns an ID',async()=>{
 const mock=createMockTransport({act:true,pass2:true});mock.actMock.methods.splice(mock.actMock.methods.indexOf('action.undo'),1);const model=createEditorModel(createHostBridge(mock.transport));await model.start();await model.actions.controller.plan({kind:'gather',layerId:'lattices'});await model.actions.controller.confirm();await model.actions.controller.list();expect(model.actions.supported('action.undo')).toBe(false);expect(model.actions.controller.getSnapshot().newestUndoableActionId).toBeNull();await model.actions.controller.undo();expect(mock.calls.includes('action.undo')).toBe(false);model.dispose();
});
test('plans with mismatched intent and malformed receipts cannot authorize effects',()=>{
 expect(()=>parsePlan({kind:'open',layerId:'b'},{kind:'gather',layerId:'a'})).toThrow();expect(()=>parseResult({ok:true,actionId:'x'})).toThrow();
});
