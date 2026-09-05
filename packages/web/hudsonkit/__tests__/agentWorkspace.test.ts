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
});
