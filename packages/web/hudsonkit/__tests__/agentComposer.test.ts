import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAgentComposer,
  createAgentRuntimePicker,
  isAgentComposerSendShortcut,
  reconcileAgentRuntime,
  type AgentRuntimeCatalog,
} from '../src/agent-composer';

const catalog: AgentRuntimeCatalog = {
  runtimes: [
    {
      value: 'codex',
      label: 'Codex',
      models: [{ value: 'astra', label: 'Astra' }],
      defaultModel: 'astra',
      defaultEffort: 'medium',
    },
    {
      value: 'local',
      label: 'Local',
      models: [{ value: 'small', label: 'Small' }],
      efforts: null,
    },
  ],
  efforts: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
  ],
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('agent composer', () => {
  it('uses IME-safe send shortcuts', () => {
    expect(isAgentComposerSendShortcut({ key: 'Enter', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, isComposing: false })).toBe(true);
    expect(isAgentComposerSendShortcut({ key: 'Enter', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, isComposing: true })).toBe(false);
    expect(isAgentComposerSendShortcut({ key: 'Enter', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, isComposing: false }, true)).toBe(true);
    expect(isAgentComposerSendShortcut({ key: 'Enter', metaKey: false, ctrlKey: false, shiftKey: true, altKey: false, isComposing: false }, true)).toBe(false);
  });

  it('dispatches send, queue, steer, and stop through typed callbacks', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const composer = createAgentComposer(host, { value: 'Analyze this', onSubmit, onStop });

    composer.element.querySelector<HTMLButtonElement>('[data-action="send"]')?.click();
    expect(onSubmit).toHaveBeenLastCalledWith('submit', 'Analyze this');

    composer.update({ active: true, steerSupported: true });
    composer.element.querySelector<HTMLButtonElement>('[data-action="queue"]')?.click();
    expect(onSubmit).toHaveBeenLastCalledWith('queue', 'Analyze this');
    composer.element.querySelector<HTMLButtonElement>('.hk-agent-composer__secondary')?.click();
    expect(onSubmit).toHaveBeenLastCalledWith('steer', 'Analyze this');
    composer.element.querySelector<HTMLButtonElement>('.hk-agent-composer__send--stop')?.click();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('renders controlled context and attachment actions', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const onContextAction = vi.fn();
    const onRemoveAttachment = vi.fn();
    const composer = createAgentComposer(host, { onSubmit: vi.fn(), onContextAction, onRemoveAttachment });
    const context = { id: 'recording', label: 'Choose recording' };
    const attachment = { id: 'file-1', name: 'notes.md' };
    composer.update({ contextItems: [context], attachments: [attachment] });

    composer.element.querySelector<HTMLButtonElement>('[data-hk-context-item="recording"]')?.click();
    composer.element.querySelector<HTMLButtonElement>('.hk-agent-composer__attachment')?.click();
    expect(onContextAction).toHaveBeenCalledWith(context);
    expect(onRemoveAttachment).toHaveBeenCalledWith(attachment);
  });

  it('provides a stable tools slot before the action controls', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const composer = createAgentComposer(host, { onSubmit: vi.fn() });
    const tool = document.createElement('button');
    composer.setTools(tool);
    expect(composer.tools.firstChild).toBe(tool);
    expect(composer.tools.nextElementSibling).toHaveClass('hk-agent-composer__secondary');
  });
});

describe('agent runtime picker', () => {
  it('reconciles runtime switches without carrying an incompatible model', () => {
    expect(reconcileAgentRuntime(catalog, { runtime: 'codex', model: 'astra', effort: 'medium' }, { runtime: 'local' }))
      .toEqual({ runtime: 'local', model: '', effort: '' });
  });

  it('exposes controlled selection and manual runtime activation', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const onChange = vi.fn();
    const picker = createAgentRuntimePicker(host, { catalog, onChange });
    picker.open();
    const local = [...picker.panel.querySelectorAll<HTMLButtonElement>('.hk-agent-runtime__runtime')]
      .find((button) => button.textContent === 'Local');
    local?.click();
    expect(onChange).toHaveBeenLastCalledWith({ runtime: 'local', model: '', effort: '' });
    expect(picker.value()).toEqual({ runtime: 'local', model: '', effort: '' });
  });
});
