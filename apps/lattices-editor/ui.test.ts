import { test, expect } from 'bun:test';
import { createHostBridge } from '../../packages/web/hudsonkit/src/editor/host-bridge';
import { createEditorModel } from './model';
import { createMockTransport } from './mock';
import { isUICommand, layoutState, applyUICommand } from './ui';
import { expandedPreset } from './presentation';
import type { AgentWorkspaceController } from '../../packages/web/hudsonkit/src/agent-workspace';

test('host chrome discovery, queued UI commands and correlated empty state reply', async () => {
  const mock = createMockTransport({ chrome: 'host' });
  const model = createEditorModel(createHostBridge(mock.transport));
  await model.start(); expect(model.getSnapshot().chrome).toBe('host');
  mock.command({ command:'toggleSource' });
  mock.command({ command:'togglePanel', value:'terminal' });
  const commands: unknown[] = []; const off = model.subscribeUI(c => commands.push(c));
  mock.command({ command:'arrangement', value:'grid' });
  expect(commands).toEqual([{ command:'toggleSource' },{ command:'arrangement', value:'grid' }]);
  const payload = layoutState(expandedPreset());
  await model.reportLayout(payload);
  expect(mock.uiStates).toEqual([payload]);
  expect(payload.panels).toEqual(['chat','preview','history','source']);
  expect(payload.sourceOpen).toBe(true); expect(model.getSnapshot().uiError).toBeNull();
  off(); model.dispose();
});
test('standalone ignores native UI extension and does not send ui.state', async () => {
  const mock = createMockTransport(); const model = createEditorModel(createHostBridge(mock.transport));
  await model.start(); expect(model.getSnapshot().chrome).toBe('standalone');
  const seen: unknown[] = []; model.subscribeUI(c => seen.push(c)); mock.command({ command:'toggleSource' });
  await model.reportLayout(layoutState(expandedPreset()));
  expect(seen).toEqual([]); expect(mock.uiStates).toEqual([]); model.dispose();
});
test('UI command validation and toggle/arrangement dispatch', () => {
  expect(isUICommand(null)).toBe(false); expect(isUICommand({command:'arrangement',value:'freeform'})).toBe(false);
  expect(isUICommand({command:'togglePanel',value:'source'})).toBe(true);
  let hidden = ['source']; const calls: unknown[] = [];
  const shell = { getPanelLayout: () => ({ hiddenPanelIds:hidden }), showPanel: (id: string) => { calls.push(['show',id]); hidden=[]; }, hidePanel:(id:string)=>calls.push(['hide',id]), setPanelLayout:(value:unknown)=>calls.push(value) } as unknown as AgentWorkspaceController;
  applyUICommand(shell,{command:'toggleSource'}); applyUICommand(shell,{command:'toggleSource'});
  applyUICommand(shell,{command:'arrangement',value:'grid'});
  expect(calls).toEqual([['show','source'],['hide','source'],{ arrangement:'grid',gridColumns:2 }]);
});
test('ui.state failure is recoverable and never marks configuration stale', async () => {
  const mock = createMockTransport({chrome:'host'}); let fail = true;
  const bridge = createHostBridge({ ...mock.transport, request: message => {
    if (message.kind === 'ui.state' && fail) return Promise.reject(new Error('Native title bar unavailable'));
    return mock.transport.request(message);
  } });
  const model = createEditorModel(bridge); await model.start();
  await model.reportLayout(layoutState(expandedPreset()));
  expect(model.getSnapshot().uiError).toBe('Native title bar unavailable');
  expect(model.getSnapshot().error).toBeNull(); expect(model.getSnapshot().status).toBe('ready');
  fail=false; await model.reportLayout(layoutState(expandedPreset())); expect(model.getSnapshot().uiError).toBeNull();
  model.dispose();
});
test('native ui.state excludes Terminal from legacy saved layouts', () => {
  const layout = expandedPreset(); layout.hiddenPanelIds = [];
  expect(layoutState(layout).panels).toEqual(['chat','preview','history','source']);
  layout.hiddenPanelIds=['source']; expect(layoutState(layout).sourceOpen).toBe(false);
});

test('host layer seed wins over web storage; ordered selection reports full state without echo', async () => {
  const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify(['unassigned']),setItem:()=>{throw Error('Host selection must not write web storage');}}});
  try {
    const mock=createMockTransport({chrome:'host',selectedLayerIds:['build','build']});
    const model=createEditorModel(createHostBridge(mock.transport));await model.start();
    expect(model.getSnapshot().selectedLayerIds).toEqual(['build']);
    await model.reportLayout(layoutState(expandedPreset()));
    expect(mock.uiStates.at(-1)).toMatchObject({selectedLayerIds:['build'],view:'overview',arrangement:'grid',sourceOpen:true});
    const before=model.selection.getSnapshot();
    mock.command({command:'selectLayers',value:['unassigned','build','unassigned']});
    await model.reportLayout(layoutState(expandedPreset()));
    expect(model.getSnapshot().selectedLayerIds).toEqual(['unassigned','build']);
    expect(model.selection.getSnapshot()).toBe(before);
    const count=mock.uiStates.length;
    mock.command({command:'selectLayers',value:['unassigned','build']});
    await Promise.resolve();expect(mock.uiStates.length).toBe(count);
    model.setSelectedLayers([]);await model.reportLayout(layoutState(expandedPreset()));
    expect(mock.uiStates.at(-1)).toMatchObject({selectedLayerIds:[]});model.dispose();
    for(const seed of [undefined,[]]) {
      const next=createEditorModel(createHostBridge(createMockTransport({chrome:'host',selectedLayerIds:seed}).transport));
      await next.start();expect(next.getSnapshot().selectedLayerIds).toEqual([]);next.dispose();
    }
  } finally { if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage'); }
});
test('standalone layer selection persists and invalid commands are rejected', async () => {
  expect(isUICommand({command:'selectLayers',value:[]})).toBe(true);
  for(const value of [null,[''],[3],'build']) expect(isUICommand({command:'selectLayers',value})).toBe(false);
  const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
  try {
    const m=createEditorModel(createHostBridge(createMockTransport().transport));await m.start();m.setSelectedLayers(['build','missing']);expect(m.getSnapshot().selectedLayerIds).toEqual(['build']);m.dispose();
    const next=createEditorModel(createHostBridge(createMockTransport().transport));await next.start();expect(next.getSnapshot().selectedLayerIds).toEqual(['build']);next.dispose();
  } finally { if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage'); }
});

test('actual Unassigned ID survives seed and removed groups normalize to All', async()=>{
  const mock=createMockTransport({chrome:'host',selectedLayerIds:['__unassigned___']});let removed=false;
  const model=createEditorModel(createHostBridge({...mock.transport,async request(message){
    const reply=await mock.transport.request(message) as import('../../packages/web/hudsonkit/src/editor/host-bridge').HostEnvelope;
    if(reply && reply.kind==='preview.project.result') {
      const p=reply.payload as import('./model').Projection;
      p.groups=p.groups.flatMap(g=>g.id==='unassigned' ? removed ? [] : [{...g,id:'__unassigned___'}] : [g]);
    }
    return reply;
  }}));
  await model.start();expect(model.getSnapshot().selectedLayerIds).toEqual(['__unassigned___']);
  removed=true;await model.refresh();expect(model.getSnapshot().selectedLayerIds).toEqual([]);model.dispose();
});
