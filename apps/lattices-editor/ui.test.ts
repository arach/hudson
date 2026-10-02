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
