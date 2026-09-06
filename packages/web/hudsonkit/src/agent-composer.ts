/**
 * Framework-free agent composer primitives.
 *
 * Interaction and visual structure are adapted from OpenScout's web
 * MessageComposer and RuntimePicker (Apache-2.0). HudsonKit owns this neutral
 * DOM implementation; products retain transport, persistence, and domain data.
 */

export type AgentComposerAction = 'submit' | 'queue' | 'steer';
export type AgentComposerFileSource = 'picker' | 'paste' | 'drop';
export type AgentComposerVoiceAction = 'start' | 'stop' | 'cancel';
export type AgentComposerVoiceStatus = 'idle' | 'preparing' | 'recording' | 'transcribing' | 'error';

export interface AgentComposerVoiceState {
  status: AgentComposerVoiceStatus;
  canCancel?: boolean;
  message?: string | null;
}

export interface AgentComposerAttachment {
  id: string;
  name: string;
  mediaType?: string;
}

export interface AgentComposerContextItem {
  id: string;
  label: string;
  title?: string;
  disabled?: boolean;
}

export interface AgentComposerState {
  value?: string;
  disabled?: boolean;
  sending?: boolean;
  active?: boolean;
  steerSupported?: boolean;
  canSend?: boolean;
  attachments?: readonly AgentComposerAttachment[];
  contextItems?: readonly AgentComposerContextItem[];
  voice?: AgentComposerVoiceState;
  status?: string | null;
  statusTone?: 'muted' | 'error';
}

export interface AgentComposerOptions {
  value?: string;
  placeholder?: string;
  ariaLabel?: string;
  rows?: number;
  sendOnEnter?: boolean;
  maxHeightPx?: number;
  minHeightPx?: number;
  accept?: string;
  multiple?: boolean;
  onChange?: (value: string, meta: { caret: number }) => void;
  onSubmit: (action: AgentComposerAction, value: string) => void;
  onStop?: () => void;
  onFiles?: (files: File[], source: AgentComposerFileSource) => void;
  onRemoveAttachment?: (attachment: AgentComposerAttachment) => void;
  onContextAction?: (item: AgentComposerContextItem) => void;
  onVoiceAction?: (action: AgentComposerVoiceAction) => void;
}

export interface AgentComposerController {
  readonly element: HTMLDivElement;
  readonly textarea: HTMLTextAreaElement;
  readonly header: HTMLDivElement;
  readonly leadingTools: HTMLDivElement;
  readonly tools: HTMLDivElement;
  readonly status: HTMLDivElement;
  update(state: AgentComposerState): void;
  setLeadingTools(content: Node | null): void;
  setTools(content: Node | null): void;
  focus(): void;
  destroy(): void;
}

const SEND_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
const STOP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
const ATTACH_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05 12.05 20.44a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"/></svg>';
const MIC_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function isAgentComposerSendShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'isComposing'>,
  sendOnEnter = false,
): boolean {
  if (event.isComposing || event.key !== 'Enter' || event.altKey) return false;
  if (event.metaKey || event.ctrlKey) return true;
  return sendOnEnter && !event.shiftKey;
}

export function resizeAgentComposer(
  textarea: HTMLTextAreaElement,
  minHeightPx = 44,
  maxHeightPx = 160,
): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeightPx), maxHeightPx)}px`;
}

function replaceSlot(slot: HTMLElement, content: Node | null) {
  slot.replaceChildren(...(content ? [content] : []));
}

export function createAgentComposer(
  host: HTMLElement,
  options: AgentComposerOptions,
): AgentComposerController {
  const root = element('div', 'hk-agent-composer');
  const frame = element('div', 'hk-agent-composer__frame');
  const shell = element('div', 'hk-agent-composer__shell');
  const header = element('div', 'hk-agent-composer__header');
  const body = element('div', 'hk-agent-composer__body');
  const textarea = element('textarea', 'hk-agent-composer__input');
  const toolbar = element('div', 'hk-agent-composer__toolbar');
  const leadingTools = element('div', 'hk-agent-composer__toolbar-start');
  const toolbarEnd = element('div', 'hk-agent-composer__toolbar-end');
  const tools = element('div', 'hk-agent-composer__tools');
  const status = element('div', 'hk-agent-composer__status');
  const fileInput = element('input');
  const voice = element('button', 'hk-agent-composer__voice');
  const voiceCancel = element('button', 'hk-agent-composer__voice-cancel');
  const attach = element('button', 'hk-agent-composer__icon-button');
  const steer = element('button', 'hk-agent-composer__secondary');
  const stop = element('button', 'hk-agent-composer__send hk-agent-composer__send--stop');
  const send = element('button', 'hk-agent-composer__send');

  textarea.value = options.value ?? '';
  textarea.placeholder = options.placeholder ?? 'Type a message…';
  textarea.setAttribute('aria-label', options.ariaLabel ?? 'Message agent');
  textarea.rows = options.rows ?? 1;

  fileInput.type = 'file';
  fileInput.hidden = true;
  fileInput.multiple = options.multiple ?? true;
  fileInput.accept = options.accept ?? 'image/*,video/*,text/plain,text/markdown,.txt,.md,.markdown';

  voice.type = 'button';
  voice.dataset.voiceAction = 'start';
  voice.hidden = !options.onVoiceAction;

  voiceCancel.type = 'button';
  voiceCancel.textContent = 'Cancel';
  voiceCancel.title = 'Cancel dictation';
  voiceCancel.setAttribute('aria-label', 'Cancel dictation');
  voiceCancel.dataset.voiceAction = 'cancel';
  voiceCancel.hidden = true;

  attach.type = 'button';
  attach.innerHTML = ATTACH_ICON;
  attach.title = 'Add attachment';
  attach.setAttribute('aria-label', 'Add attachment');
  attach.hidden = !options.onFiles;

  steer.type = 'button';
  steer.textContent = 'Steer';
  steer.title = 'Steer the current turn';
  steer.hidden = true;

  stop.type = 'button';
  stop.innerHTML = STOP_ICON;
  stop.title = 'Stop agent';
  stop.setAttribute('aria-label', 'Stop agent');
  stop.hidden = true;

  send.type = 'button';
  send.innerHTML = SEND_ICON;
  send.title = 'Send (Cmd+Enter)';
  send.setAttribute('aria-label', 'Send message');
  send.dataset.action = 'send';

  header.hidden = true;
  status.hidden = true;
  body.append(textarea);
  leadingTools.append(voice, voiceCancel, attach);
  toolbarEnd.append(tools, steer, stop, send);
  toolbar.append(leadingTools, toolbarEnd);
  shell.append(header, body, toolbar, status);
  frame.append(shell);
  root.append(frame, fileInput);
  host.replaceChildren(root);

  let state: AgentComposerState = {
    value: textarea.value,
    voice: options.onVoiceAction ? { status: 'idle' } : undefined,
  };
  const disposers: Array<() => void> = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, listener as EventListener);
    disposers.push(() => target.removeEventListener(type, listener as EventListener));
  };

  const submit = (action: AgentComposerAction) => {
    if (state.disabled || state.sending) return;
    const canSend = state.canSend ?? textarea.value.trim().length > 0;
    if (!canSend) return;
    options.onSubmit(action, textarea.value);
  };

  listen(textarea, 'input', () => {
    state.value = textarea.value;
    resizeAgentComposer(textarea, options.minHeightPx, options.maxHeightPx);
    options.onChange?.(textarea.value, { caret: textarea.selectionStart ?? textarea.value.length });
    send.disabled = state.canSend === undefined ? !textarea.value.trim() : !state.canSend;
    steer.disabled = send.disabled;
  });
  listen(textarea, 'keydown', (event) => {
    if (!isAgentComposerSendShortcut(event, options.sendOnEnter)) return;
    event.preventDefault();
    submit(state.active ? 'queue' : 'submit');
  });
  listen(send, 'click', () => submit(state.active ? 'queue' : 'submit'));
  listen(steer, 'click', () => submit('steer'));
  listen(stop, 'click', () => options.onStop?.());
  listen(voice, 'click', () => {
    const voiceStatus = state.voice?.status ?? 'idle';
    if (voiceStatus === 'recording') options.onVoiceAction?.('stop');
    else if (voiceStatus === 'idle' || voiceStatus === 'error') options.onVoiceAction?.('start');
  });
  listen(voiceCancel, 'click', () => options.onVoiceAction?.('cancel'));
  listen(attach, 'click', () => fileInput.click());
  listen(fileInput, 'change', () => {
    const files = [...(fileInput.files ?? [])];
    if (files.length) options.onFiles?.(files, 'picker');
    fileInput.value = '';
  });
  listen(textarea, 'paste', (event) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!files.length || !options.onFiles) return;
    event.preventDefault();
    options.onFiles(files, 'paste');
  });
  listen(shell, 'dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files') || !options.onFiles) return;
    event.preventDefault();
    shell.dataset.dragActive = 'true';
  });
  listen(shell, 'dragleave', (event) => {
    if (shell.contains(event.relatedTarget as Node | null)) return;
    delete shell.dataset.dragActive;
  });
  listen(shell, 'drop', (event) => {
    delete shell.dataset.dragActive;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.length || !options.onFiles) return;
    event.preventDefault();
    options.onFiles(files, 'drop');
  });

  const update = (next: AgentComposerState) => {
    state = { ...state, ...next };
    if (next.value !== undefined && textarea.value !== next.value) textarea.value = next.value;
    const disabled = Boolean(state.disabled || state.sending);
    textarea.disabled = disabled;
    attach.disabled = disabled;
    stop.disabled = Boolean(state.disabled);
    const voiceState = state.voice ?? { status: 'idle' as const };
    const voiceBusy = voiceState.status === 'preparing' || voiceState.status === 'transcribing';
    const voiceRecording = voiceState.status === 'recording';
    const voiceLabel = voiceRecording
      ? 'Stop dictation'
      : voiceState.status === 'preparing'
        ? 'Preparing…'
        : voiceState.status === 'transcribing'
          ? 'Transcribing…'
          : 'Dictate';
    voice.hidden = !options.onVoiceAction;
    voice.disabled = Boolean(state.disabled || voiceBusy);
    voice.dataset.voiceStatus = voiceState.status;
    voice.dataset.voiceAction = voiceRecording ? 'stop' : 'start';
    voice.setAttribute('aria-label', voiceLabel);
    voice.setAttribute('aria-pressed', String(voiceRecording));
    if (voiceBusy) voice.setAttribute('aria-busy', 'true');
    else voice.removeAttribute('aria-busy');
    voice.title = voiceState.message || voiceLabel;
    voice.replaceChildren();
    if (voiceBusy) {
      const progress = element('span', 'hk-agent-composer__voice-progress');
      progress.setAttribute('aria-hidden', 'true');
      voice.append(progress);
    } else {
      voice.insertAdjacentHTML('afterbegin', voiceRecording ? STOP_ICON : MIC_ICON);
    }
    const voiceText = element('span');
    voiceText.textContent = voiceLabel;
    voice.append(voiceText);
    voiceCancel.hidden = !(options.onVoiceAction && voiceBusy && voiceState.canCancel);
    voiceCancel.disabled = Boolean(state.disabled);
    const canSend = state.canSend ?? textarea.value.trim().length > 0;
    send.disabled = disabled || !canSend;
    steer.disabled = disabled || !canSend;
    stop.hidden = !state.active;
    steer.hidden = !(state.active && state.steerSupported);
    send.dataset.action = state.active ? 'queue' : 'send';
    send.title = state.active ? 'Queue (Cmd+Enter)' : 'Send (Cmd+Enter)';
    send.setAttribute('aria-label', state.active ? 'Queue message after current turn' : 'Send message');
    send.replaceChildren();
    send.insertAdjacentHTML('afterbegin', SEND_ICON);
    if (state.active) {
      const label = element('span', 'hk-agent-composer__action-label');
      label.textContent = 'Queue';
      send.append(label);
    }
    if (next.attachments) {
      header.replaceChildren(...next.attachments.map((attachment) => {
        const chip = element('button', 'hk-agent-composer__attachment');
        chip.type = 'button';
        chip.textContent = `${attachment.name} ×`;
        chip.title = `Remove ${attachment.name}`;
        chip.addEventListener('click', () => options.onRemoveAttachment?.(attachment));
        return chip;
      }));
      header.hidden = next.attachments.length === 0;
    }
    if (next.contextItems) {
      leadingTools.querySelectorAll('[data-hk-context-item]').forEach((node) => node.remove());
      for (const item of next.contextItems) {
        const context = element('button', 'hk-agent-composer__tool');
        context.type = 'button';
        context.textContent = item.label;
        context.title = item.title ?? item.label;
        context.disabled = disabled || Boolean(item.disabled);
        context.dataset.itemDisabled = item.disabled ? 'true' : 'false';
        context.dataset.hkContextItem = item.id;
        context.addEventListener('click', () => options.onContextAction?.(item));
        leadingTools.append(context);
      }
    }
    leadingTools.querySelectorAll<HTMLButtonElement>('[data-hk-context-item]').forEach((context) => {
      context.disabled = disabled || context.dataset.itemDisabled === 'true';
    });
    if (next.status !== undefined) {
      status.textContent = next.status ?? '';
      status.hidden = !next.status;
      status.dataset.tone = next.statusTone ?? 'muted';
    }
    resizeAgentComposer(textarea, options.minHeightPx, options.maxHeightPx);
  };

  update(state);
  return {
    element: root,
    textarea,
    header,
    leadingTools,
    tools,
    status,
    update,
    setLeadingTools: (content) => {
      replaceSlot(leadingTools, content);
      leadingTools.append(voice, voiceCancel, attach);
    },
    setTools: (content) => {
      replaceSlot(tools, content);
    },
    focus: () => textarea.focus(),
    destroy: () => {
      disposers.splice(0).forEach((dispose) => dispose());
      root.remove();
    },
  };
}

export interface AgentRuntimeOption {
  value: string;
  label: string;
  note?: string;
  disabled?: boolean;
}

export interface AgentRuntime extends AgentRuntimeOption {
  models: readonly AgentRuntimeOption[];
  efforts?: readonly AgentRuntimeOption[] | null;
  defaultModel?: string;
  defaultEffort?: string;
}

export interface AgentRuntimeCatalog {
  runtimes: readonly AgentRuntime[];
  efforts?: readonly AgentRuntimeOption[];
}

export interface AgentRuntimeValue {
  runtime: string;
  model: string;
  effort: string;
}

export interface AgentRuntimePickerOptions {
  catalog: AgentRuntimeCatalog;
  value?: Partial<AgentRuntimeValue>;
  onChange?: (value: AgentRuntimeValue) => void;
  disabled?: boolean;
}

export interface AgentRuntimePickerController {
  readonly element: HTMLDivElement;
  readonly trigger: HTMLButtonElement;
  readonly panel: HTMLElement;
  value(): AgentRuntimeValue;
  update(options: Partial<AgentRuntimePickerOptions>): void;
  open(): void;
  close(): void;
  destroy(): void;
}

function firstEnabled<T extends AgentRuntimeOption>(options: readonly T[]): T | undefined {
  return options.find((option) => !option.disabled);
}

export function reconcileAgentRuntime(
  catalog: AgentRuntimeCatalog,
  current: AgentRuntimeValue,
  patch: Partial<AgentRuntimeValue>,
): AgentRuntimeValue {
  const next = { ...current, ...patch };
  const runtime = catalog.runtimes.find((item) => item.value === next.runtime) ?? firstEnabled(catalog.runtimes);
  if (!runtime) return next;
  next.runtime = runtime.value;
  if (patch.runtime !== undefined && patch.runtime !== current.runtime && patch.model === undefined) {
    next.model = runtime.defaultModel ?? '';
  }
  const efforts = runtime.efforts === undefined ? (catalog.efforts ?? []) : (runtime.efforts ?? []);
  if (runtime.efforts === null) next.effort = '';
  else if (!efforts.some((effort) => effort.value === next.effort)) {
    next.effort = runtime.defaultEffort ?? firstEnabled(efforts)?.value ?? '';
  }
  return next;
}

export function createAgentRuntimePicker(
  host: HTMLElement,
  initial: AgentRuntimePickerOptions,
): AgentRuntimePickerController {
  const root = element('div', 'hk-agent-runtime');
  const portal = element('div', 'hk-agent-runtime hk-agent-runtime__portal');
  const trigger = element('button', 'hk-agent-runtime__trigger');
  const panel = element('section', 'hk-agent-runtime__panel');
  const main = element('div', 'hk-agent-runtime__main');
  const runtimes = element('div', 'hk-agent-runtime__runtimes');
  const models = element('div', 'hk-agent-runtime__models');
  const effortWrap = element('div', 'hk-agent-runtime__efforts-wrap');
  const effortLabel = element('span', 'hk-agent-runtime__label');
  const efforts = element('div', 'hk-agent-runtime__efforts');
  effortLabel.textContent = 'Reasoning effort';
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Agent runtime');
  runtimes.setAttribute('role', 'group');
  runtimes.setAttribute('aria-label', 'Runtime');
  models.setAttribute('role', 'group');
  models.setAttribute('aria-label', 'Model');
  efforts.setAttribute('role', 'radiogroup');
  efforts.setAttribute('aria-label', 'Reasoning effort');
  main.append(runtimes, models);
  effortWrap.append(effortLabel, efforts);
  panel.append(main, effortWrap);
  root.append(trigger);
  portal.append(panel);
  host.append(root);
  document.body.append(portal);

  let options = initial;
  const seedRuntime = firstEnabled(options.catalog.runtimes);
  let current = reconcileAgentRuntime(options.catalog, {
    runtime: options.value?.runtime ?? seedRuntime?.value ?? '',
    model: options.value?.model ?? seedRuntime?.defaultModel ?? '',
    effort: options.value?.effort ?? seedRuntime?.defaultEffort ?? '',
  }, {});

  const choose = (patch: Partial<AgentRuntimeValue>) => {
    current = reconcileAgentRuntime(options.catalog, current, patch);
    options.onChange?.({ ...current });
    render();
  };

  const button = (option: AgentRuntimeOption, selected: boolean, onChoose: () => void, className: string) => {
    const node = element('button', className);
    node.type = 'button';
    node.textContent = option.label;
    node.disabled = option.disabled ?? false;
    node.title = option.note ?? option.label;
    node.dataset.selected = selected ? 'true' : undefined;
    node.addEventListener('click', onChoose);
    return node;
  };

  const render = () => {
    const runtime = options.catalog.runtimes.find((item) => item.value === current.runtime) ?? firstEnabled(options.catalog.runtimes);
    const model = runtime?.models.find((item) => item.value === current.model);
    const runtimeEfforts = runtime?.efforts === undefined ? (options.catalog.efforts ?? []) : (runtime.efforts ?? []);
    const effort = runtimeEfforts.find((item) => item.value === current.effort);
    const modelLabel = model?.label ?? (current.model || 'Auto');
    const effortText = effort?.label ?? (current.effort || 'Auto');
    trigger.textContent = `${modelLabel}${runtime?.efforts === null ? '' : ` · ${effortText}`} ⌄`;
    trigger.setAttribute('aria-label', `${runtime?.label ?? 'Runtime'}, ${modelLabel}. Choose runtime`);
    trigger.disabled = options.disabled ?? false;
    runtimes.replaceChildren(...options.catalog.runtimes.map((item) =>
      button(item, item.value === current.runtime, () => choose({ runtime: item.value }), 'hk-agent-runtime__runtime')));
    models.replaceChildren(...([{ value: '', label: 'Auto — runtime default' }, ...(runtime?.models ?? [])].map((item) =>
      button(item, item.value === current.model, () => choose({ model: item.value }), 'hk-agent-runtime__option'))));
    const custom = element('label', 'hk-agent-runtime__custom');
    custom.append('Custom model');
    const customInput = element('input');
    customInput.placeholder = 'Model ID or Auto';
    customInput.autocomplete = 'off';
    customInput.value = runtime?.models.some((item) => item.value === current.model) ? '' : current.model;
    customInput.addEventListener('change', () => choose({ model: customInput.value.trim() }));
    customInput.addEventListener('keydown', (event) => {
      if (event.isComposing || event.key !== 'Enter') return;
      event.preventDefault();
      choose({ model: customInput.value.trim() });
      close();
      trigger.focus();
    });
    custom.append(customInput);
    models.append(custom);
    effortWrap.hidden = runtime?.efforts === null;
    efforts.replaceChildren(...runtimeEfforts.map((item) => {
      const node = button(item, item.value === current.effort, () => choose({ effort: item.value }), 'hk-agent-runtime__effort');
      node.setAttribute('role', 'radio');
      node.setAttribute('aria-checked', String(item.value === current.effort));
      return node;
    }));
  };

  const close = () => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  const positionPanel = () => {
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(460, Math.max(240, window.innerWidth - 24));
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, triggerRect.right - width))}px`;
    const measuredHeight = Math.min(panel.scrollHeight || 300, Math.max(180, window.innerHeight - 24));
    const opensAbove = triggerRect.top >= measuredHeight + 8;
    panel.style.top = opensAbove
      ? `${Math.max(12, triggerRect.top - measuredHeight - 8)}px`
      : `${Math.min(window.innerHeight - measuredHeight - 12, triggerRect.bottom + 8)}px`;
    panel.style.maxHeight = `${Math.max(180, opensAbove ? triggerRect.top - 20 : window.innerHeight - triggerRect.bottom - 20)}px`;
  };
  const open = () => {
    if (options.disabled) return;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    positionPanel();
    panel.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  };
  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (panel.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      trigger.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (!panel.contains(target)) return;
    const group = target.parentElement;
    const candidates = [...(group?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const index = candidates.indexOf(target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    candidates[(index + delta + candidates.length) % candidates.length]?.focus();
  };
  const onDocumentPointerdown = (event: PointerEvent) => {
    if (!root.contains(event.target as Node) && !portal.contains(event.target as Node)) close();
  };
  trigger.addEventListener('click', () => panel.hidden ? open() : close());
  document.addEventListener('keydown', onDocumentKeydown);
  document.addEventListener('pointerdown', onDocumentPointerdown);
  render();

  return {
    element: root,
    trigger,
    panel,
    value: () => ({ ...current }),
    update: (next) => {
      options = { ...options, ...next };
      if (next.value || next.catalog) current = reconcileAgentRuntime(options.catalog, current, next.value ?? {});
      render();
    },
    open,
    close,
    destroy: () => {
      document.removeEventListener('keydown', onDocumentKeydown);
      document.removeEventListener('pointerdown', onDocumentPointerdown);
      root.remove();
      portal.remove();
    },
  };
}
