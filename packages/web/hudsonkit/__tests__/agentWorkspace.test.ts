import { afterEach, describe, expect, it } from 'vitest';
import { createAgentWorkspace } from '../src/agent-workspace';

afterEach(() => document.body.replaceChildren());

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
});
