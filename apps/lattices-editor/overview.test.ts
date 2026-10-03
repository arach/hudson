import { expect, test } from 'bun:test';
import { overviewFacts } from './overview-data';
import { createMockTransport } from './mock';
import { createEditorModel } from './model';
import { createHostBridge } from '../../packages/web/hudsonkit/src/editor/host-bridge';
import { layoutState, isUICommand } from './ui';
import { expandedPreset } from './presentation';
test('Overview uses host membership and duplicate rule occurrences, omits unknown facts',()=>{
 const mock=createMockTransport({rich:true,overview:true}); const p=mock.fixture().projection;
 const f=overviewFacts(p,'build'); expect(f.rows.length).toBe(3);expect(f.ruleCount).toBe(4);expect(f.rules[0].occurrences).toBe(2);
 expect(f.pinned).toBeUndefined();expect(f.displays).toEqual([]); expect(f.description).toContain('3 open windows');
 const empty=overviewFacts(p,'overview:0');expect(empty.rows).toEqual([]);expect(empty.description).toBe('No windows are open.');
});
test('Overview default, view command/state and persisted Workspace restoration',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
 try {
  const mock=createMockTransport({chrome:'host'});const model=createEditorModel(createHostBridge(mock.transport));await model.start();
  expect(model.getSnapshot().view).toBe('overview'); await model.reportLayout(layoutState(expandedPreset()));
  mock.command({command:'view',value:'workspace'});await model.reportLayout(layoutState(expandedPreset()));
  expect(model.getSnapshot().view).toBe('workspace'); expect(mock.uiStates.at(-1)).toMatchObject({view:'workspace'});
  expect(isUICommand({command:'view',value:'bogus'})).toBe(false); model.dispose();
  const second=createEditorModel(createHostBridge(createMockTransport().transport));await second.start();expect(second.getSnapshot().view).toBe('workspace');second.dispose();
 } finally {if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('matched-by counts come from entry keys, unmatched rules and explicit pin/display facts only',()=>{
 const p=createMockTransport().fixture().projection;
 p.entries.push({key:'unmatched',layerId:'build',canonical:JSON.stringify({app:'Notes',title:'Draft',pins:[{wid:7}],display:1}),ranges:[{from:0,to:1}],ambiguous:false});
 const f=overviewFacts(p,'build');expect(f.rules.at(-1)?.open).toBe(0);expect(f.pinned).toBe(1);expect(f.displays).toEqual(['1']);expect(f.description).toContain('1 rule has no match');
});

test('All and multi-layer facts use projection counts; toggles preserve insertion order', async()=>{
 const {overviewSelectionFacts,toggleLayer}=await import('./overview-data');const p=createMockTransport({rich:true,overview:true}).fixture().projection;
 expect(overviewSelectionFacts(p,[]).rows.length).toBe(4);
 expect(overviewSelectionFacts(p,['build','overview:0']).rows.length).toBe(3);
 expect(toggleLayer(['build'],'overview:0',true)).toEqual(['build','overview:0']);
 expect(toggleLayer(['build','overview:0'],'build',true)).toEqual(['overview:0']);
 expect(toggleLayer(['build'],'unassigned',false)).toEqual(['unassigned']);
});
