import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { act, createContext, useContext, useState, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPanels } from '../../packages/web/hudsonkit/src/editor-panels';
import { panelPreset } from '../../packages/web/hudsonkit/src/editor/layout-persistence';
import type { AgentWorkspaceController } from '../../packages/web/hudsonkit/src/agent-workspace';
test('StrictMode portals retain Provider and state across hide/move/show; teardown is paired', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true };
  for (const [key, value] of Object.entries(globals)) { descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const Ctx = createContext('missing');
  function Counter() { const value = useContext(Ctx); const [n, set] = useState(0); return <button id="counter" onClick={() => set(n + 1)}>{value}:{n}</button>; }
  let controller: AgentWorkspaceController | null = null;
  const readiness: boolean[] = [], saves: unknown[] = [];
  const panels = [{ id:'one', label:'One', showActions:false, content:<Counter /> }, { id:'two',label:'Two',content:<p>Two</p> }];
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(<StrictMode><Ctx.Provider value="shared"><EditorPanels panels={panels}
      layout={panelPreset(['one','two'], ['one'])}
      onReady={c => { controller = c; readiness.push(!!c); }}
      onLayoutChange={l => saves.push(l)} /></Ctx.Provider></StrictMode>));
    expect(readiness).toEqual([true,false,true]);
    expect(controller!.getPanelLayout().hiddenPanelIds).toEqual(['two']);
    expect(saves).toHaveLength(0);
    expect((dom.window.document.querySelector('[data-panel-id="one"] .hk-agent-workspace__panel-actions') as HTMLElement).hidden).toBe(true);
    expect((dom.window.document.querySelector('[data-panel-id="two"] .hk-agent-workspace__panel-actions') as HTMLElement).hidden).toBe(false);
    await act(async () => dom.window.document.getElementById('counter')!.click());
    expect(dom.window.document.getElementById('counter')?.textContent).toBe('shared:1');
    await act(async () => { controller!.hidePanel('one'); controller!.showPanel('two'); controller!.movePanel('one',1); controller!.showPanel('one'); });
    expect(dom.window.document.getElementById('counter')?.textContent).toBe('shared:1');
    expect(controller!.getPanelLayout().order).toEqual(['two','one']);
    await act(async () => root.unmount());
    expect(readiness.at(-1)).toBe(false);
    expect(dom.window.document.querySelector('.hk-agent-workspace')).toBeNull();
  } finally {
    dom.window.close();
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('disabled composer keeps opt-in context removal available, never send', async () => {
  const { createAgentComposer } = await import('../../packages/web/hudsonkit/src/agent-composer');
  const dom = new JSDOM('<div id="composer"></div>');
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  const removed: string[] = [];
  const composer = createAgentComposer(dom.window.document.getElementById('composer')!, { onSubmit: () => { throw new Error('Must not send'); }, onContextAction: item => removed.push(item.id) });
  try {
    composer.update({ disabled: true, contextItems: [{ id:'one', label:'Window', title:'Remove Window' }] });
    const chip = () => dom.window.document.querySelector<HTMLButtonElement>('[data-hk-context-item]')!;
    expect(chip().disabled).toBe(true);
    composer.update({ contextActionsEnabled: true });
    expect(chip().disabled).toBe(false);
    chip().click(); expect(removed).toEqual(['one']);
    expect(composer.textarea.disabled).toBe(true);
    expect(dom.window.document.querySelector<HTMLButtonElement>('[data-action="send"]')!.disabled).toBe(true);
  } finally {
    composer.destroy(); dom.window.close();
    if (old) Object.defineProperty(globalThis,'document',old); else Reflect.deleteProperty(globalThis,'document');
  }
});
