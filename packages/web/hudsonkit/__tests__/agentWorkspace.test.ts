import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentWorkspace } from '../src/agent-workspace';

afterEach(() => {
  document.body.replaceChildren();
  delete (document as Document & { elementFromPoint?: Document['elementFromPoint'] }).elementFromPoint;
});

describe('agent workspace', () => {
  it('mounts host-owned content into stable presentation slots', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const composer = document.createElement('form');
    const editor = document.createElement('div');
    const workspace = createAgentWorkspace(host, { composer, editor });

    expect(workspace.slots.composer.firstChild).toBe(composer);
    expect(workspace.slots.editor.firstChild).toBe(editor);
    expect(workspace.artifact.hidden).toBe(false);
  });

  it('updates visibility and clamps the split register', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const workspace = createAgentWorkspace(host);
    workspace.update({ artifactVisible: false, navigationVisible: false, splitPercent: 90 });

    expect(workspace.artifact.hidden).toBe(true);
    expect(workspace.navigation.hidden).toBe(true);
    expect(workspace.element.dataset.artifactVisible).toBe('false');
    expect(workspace.element.style.getPropertyValue('--hk-agent-workspace-split')).toBe('75%');
  });

  it('replaces individual slots without rebuilding the workspace', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const workspace = createAgentWorkspace(host);
    const history = document.createElement('ol');
    workspace.setSlot('conversation', history);
    expect(workspace.slots.conversation.firstChild).toBe(history);
  });

  it('mounts arbitrary tools behind an accessible controlled tab surface', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const results = document.createElement('output');
    const editor = document.createElement('div');
    const selections: [string, string][] = [];
    const workspace = createAgentWorkspace(host, {}, {
      tools: [
        { id: 'results', label: 'Test results', content: results },
        { id: 'editor', label: 'Editor', content: editor },
      ],
      selectedToolId: 'results',
      onToolSelect: (id, pane) => selections.push([id, pane]),
    });

    const tabs = workspace.toolTabs.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(workspace.primaryToolPane.contains(results)).toBe(true);

    tabs[1]?.click();
    expect(selections).toEqual([['editor', 'primary']]);
    expect(workspace.primaryToolPane.contains(editor)).toBe(true);
    expect(workspace.element).toBe(host.firstElementChild);
  });

  it('selects distinct tools into accessible split panes', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const results = document.createElement('output');
    const terminal = document.createElement('div');
    const layouts: string[] = [];
    const workspace = createAgentWorkspace(host, {}, {
      tools: [
        { id: 'results', label: 'Test', content: results },
        { id: 'terminal', label: 'Terminal', content: terminal },
      ],
      selectedToolId: 'results',
      onToolLayoutChange: (layout) => layouts.push(layout),
    });

    const split = workspace.element.querySelector<HTMLButtonElement>('.hk-agent-workspace__split-button');
    split?.click();
    expect(layouts).toEqual(['split']);
    expect(workspace.element.dataset.toolLayout).toBe('split');
    expect(workspace.primaryToolPane.contains(results)).toBe(true);
    expect(workspace.secondaryToolPane.contains(terminal)).toBe(true);
    expect(workspace.secondaryToolPane.hidden).toBe(false);

    workspace.update({ toolSplitPercent: 80, navigationVisible: false });
    expect(workspace.element.style.getPropertyValue('--hk-agent-workspace-tool-split')).toBe('75%');
    expect(workspace.navigation.hidden).toBe(true);
  });

  it('supports keyboard traversal without activating a disabled tool', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const workspace = createAgentWorkspace(host, {}, {
      tools: [
        { id: 'results', label: 'Test', content: document.createElement('div') },
        { id: 'editor', label: 'Editor', content: document.createElement('div'), disabled: true },
        { id: 'terminal', label: 'Terminal', content: document.createElement('div') },
      ],
    });
    const tabs = workspace.toolTabs.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[2]);
  });

  it('uses peer panels instead of the fixed conversation rail when provided', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const details = document.createElement('article');
    const test = document.createElement('output');
    const workspace = createAgentWorkspace(host, { conversation: document.createElement('ol') }, {
      panels: [
        { id: 'details', label: 'Details', content: details },
        { id: 'test', label: 'Test', content: test },
      ],
      panelLayout: {
        arrangement: 'single',
        focusedPanelId: 'details',
        hiddenPanelIds: ['test'],
      },
    });

    expect(workspace.conversation.parentElement?.hidden).toBe(true);
    expect(workspace.panelLayout.hidden).toBe(false);
    expect(details.isConnected).toBe(true);
    expect(test.isConnected).toBe(true);
    expect(workspace.getPanelLayout().focusedPanelId).toBe('details');
  });

  it('retains panel DOM nodes while showing, focusing, arranging, and reordering', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const details = document.createElement('article');
    const editor = document.createElement('div');
    const workspace = createAgentWorkspace(host, {}, {
      panels: [
        { id: 'details', label: 'Details', content: details },
        { id: 'editor', label: 'IDE', content: editor },
      ],
      panelLayout: { hiddenPanelIds: ['editor'] },
    });
    const detailsMount = details.parentElement;
    const editorMount = editor.parentElement;

    workspace.showPanel('editor');
    workspace.setPanelLayout({ arrangement: 'columns' });
    workspace.movePanel('editor', 0);
    workspace.focusPanel('details');

    expect(details.isConnected).toBe(true);
    expect(editor.isConnected).toBe(true);
    expect(details.parentElement).toBe(detailsMount);
    expect(editor.parentElement).toBe(editorMount);
    expect(workspace.getPanelLayout().order).toEqual(['editor', 'details']);
    expect(workspace.getPanelLayout().focusedPanelId).toBe('details');
  });

  it('emits serializable layout changes for show, hide, focus, and arrangement', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const changes: [string, string][] = [];
    const workspace = createAgentWorkspace(host, {}, {
      panels: ['details', 'test', 'terminal'].map((id) => ({
        id,
        label: id,
        content: document.createElement('div'),
      })),
      panelLayout: { hiddenPanelIds: ['test'] },
      onPanelLayoutChange: (state, reason) => {
        changes.push([reason, JSON.stringify(state)]);
      },
    });

    workspace.showPanel('test');
    workspace.setPanelLayout({ arrangement: 'grid', gridColumns: 2 });
    workspace.hidePanel('terminal');
    workspace.focusPanel('details');

    expect(changes.map(([reason]) => reason)).toEqual(['show', 'state', 'hide', 'focus']);
    expect(JSON.parse(changes[2]![1]).hiddenPanelIds).toEqual(['terminal']);
  });

  it('reorders from the keyboard and resizes tracks through separators', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const changes: string[] = [];
    const workspace = createAgentWorkspace(host, {}, {
      panels: ['details', 'test', 'terminal'].map((id) => ({
        id,
        label: id,
        content: document.createElement('div'),
      })),
      panelLayout: { arrangement: 'columns' },
      onPanelLayoutChange: (_state, reason) => changes.push(reason),
    });

    const firstHandle = workspace.panelLayout.querySelector<HTMLButtonElement>('[data-panel-id="details"] .hk-agent-workspace__panel-handle');
    firstHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    expect(workspace.getPanelLayout().order).toEqual(['test', 'details', 'terminal']);

    const separator = workspace.panelLayout.querySelector<HTMLElement>('[role="separator"]');
    separator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const sizes = workspace.getPanelLayout().columnSizes!;
    expect(sizes[0]).toBeCloseTo(38.33, 2);
    expect(sizes[1]).toBeCloseTo(28.33, 2);
    expect(sizes[2]).toBeCloseTo(33.33, 2);
    expect(changes).toContain('reorder');
    expect(changes).toContain('resize');
  });

  it('reorders and hides panels from each panel action menu', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const workspace = createAgentWorkspace(host, {}, {
      panels: ['details', 'test', 'terminal'].map((id) => ({
        id,
        label: id,
        content: document.createElement('div'),
      })),
      panelLayout: { arrangement: 'rows' },
    });
    const details = workspace.panelLayout.querySelector<HTMLElement>('[data-panel-id="details"]')!;
    const actions = details.querySelectorAll<HTMLButtonElement>('.hk-agent-workspace__panel-action');
    actions[1]?.click();
    expect(workspace.getPanelLayout().order).toEqual(['test', 'details', 'terminal']);

    actions[2]?.click();
    expect(workspace.getPanelLayout().hiddenPanelIds).toEqual(['details']);
  });

  it('uses a compact pointer proxy and commits the prospective drop panel', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const changes: string[] = [];
    const workspace = createAgentWorkspace(host, {}, {
      panels: ['details', 'test', 'terminal'].map((id) => ({
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
        content: document.createElement('div'),
      })),
      panelLayout: { arrangement: 'columns' },
      onPanelLayoutChange: (_state, reason) => changes.push(reason),
    });
    const source = workspace.panelLayout.querySelector<HTMLElement>('[data-panel-id="details"]')!;
    const target = workspace.panelLayout.querySelector<HTMLElement>('[data-panel-id="terminal"]')!;
    const handle = source.querySelector<HTMLButtonElement>('.hk-agent-workspace__panel-handle')!;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      return event;
    };
    handle.dispatchEvent(pointer('pointerdown', 10, 10));

    handle.dispatchEvent(pointer('pointermove', 12, 12));
    expect(document.querySelector('.hk-agent-workspace__panel-drag-preview')).toBeNull();

    handle.dispatchEvent(pointer('pointermove', 30, 40));

    const preview = document.body.querySelector<HTMLElement>('.hk-agent-workspace__panel-drag-preview');
    expect(preview?.textContent).toBe('Details');
    expect(preview?.getAttribute('aria-hidden')).toBe('true');
    expect(preview?.style.left).toBe('44px');
    expect(preview?.style.top).toBe('54px');
    expect(source.dataset.dragSource).toBe('true');
    expect(workspace.panelLayout.dataset.draggingPanel).toBe('details');
    expect(target.dataset.dropTarget).toBe('true');

    handle.dispatchEvent(pointer('pointerup', 30, 40));
    expect(workspace.getPanelLayout().order).toEqual(['test', 'terminal', 'details']);
    expect(source.dataset.dragSource).toBeUndefined();
    expect(target.dataset.dropTarget).toBeUndefined();
    expect(workspace.panelLayout.dataset.draggingPanel).toBeUndefined();
    expect(document.querySelector('.hk-agent-workspace__panel-drag-preview')).toBeNull();
    expect(changes).toContain('reorder');
  });

  it('clears pointer drag affordances when Escape cancels the gesture', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const workspace = createAgentWorkspace(host, {}, {
      panels: ['details', 'test'].map((id) => ({
        id,
        label: id,
        content: document.createElement('div'),
      })),
      panelLayout: { arrangement: 'columns' },
    });
    const source = workspace.panelLayout.querySelector<HTMLElement>('[data-panel-id="details"]')!;
    const target = workspace.panelLayout.querySelector<HTMLElement>('[data-panel-id="test"]')!;
    const handle = source.querySelector<HTMLButtonElement>('.hk-agent-workspace__panel-handle')!;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 3 });
      return event;
    };
    handle.dispatchEvent(pointer('pointerdown', 0, 0));
    handle.dispatchEvent(pointer('pointermove', 20, 20));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(source.dataset.dragSource).toBeUndefined();
    expect(target.dataset.dropTarget).toBeUndefined();
    expect(workspace.panelLayout.dataset.draggingPanel).toBeUndefined();
    expect(document.querySelector('.hk-agent-workspace__panel-drag-preview')).toBeNull();
    expect(workspace.getPanelLayout().order).toEqual(['details', 'test']);
  });

  it('rejects duplicate panel ids and keeps at least one panel visible', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const workspace = createAgentWorkspace(host, {}, {
      panels: [{ id: 'details', label: 'Details', content: document.createElement('div') }],
    });
    workspace.hidePanel('details');
    expect(workspace.getPanelLayout().hiddenPanelIds).toEqual([]);
    expect(() => workspace.setPanels([
      { id: 'same', label: 'One', content: document.createElement('div') },
      { id: 'same', label: 'Two', content: document.createElement('div') },
    ])).toThrow('Agent workspace panel ids must be unique');
  });
});
