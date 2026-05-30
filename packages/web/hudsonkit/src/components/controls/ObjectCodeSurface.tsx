'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Columns2,
  FileCode2,
  GitBranchPlus,
  Loader2,
  Maximize2,
  MessageSquare,
  PanelLeft,
  Save,
  Send,
  X,
} from 'lucide-react';
import { TextDocumentSurface } from './TextDocument';
import type {
  HudsonCodeChatSurface,
  HudsonCodeObject,
  HudsonCodeSurfacePlacement,
  HudsonCodeWorkbenchSize,
} from '../../types/code';

export interface ObjectCodeSurfaceProps {
  object: HudsonCodeObject | null;
  placement?: HudsonCodeSurfacePlacement;
  onClose?: () => void;
  className?: string;
  emptyMessage?: string;
  headerActions?: React.ReactNode;
}

export interface ObjectCodeWorkbenchProps {
  object: HudsonCodeObject | null;
  size: HudsonCodeWorkbenchSize;
  onSizeChange: (size: HudsonCodeWorkbenchSize) => void;
  onClose: () => void;
  chat?: HudsonCodeChatSurface;
  editorWidth?: number;
  chatWidth?: number;
  onEditorWidthChange?: (width: number) => void;
  onChatWidthChange?: (width: number) => void;
  className?: string;
}

const EDITOR_MIN_WIDTH = 280;
const EDITOR_MAX_WIDTH = 920;
const CHAT_MIN_WIDTH = 240;
const CHAT_MAX_WIDTH = 560;

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function placementClass(placement: HudsonCodeSurfacePlacement) {
  if (placement === 'workbench') {
    return 'h-full min-h-0 border-r border-border/70 bg-background/96';
  }
  if (placement === 'sheet') {
    return 'h-full w-[min(48vw,720px)] min-w-[360px] max-w-[760px] border-l border-border/70 bg-background/94 shadow-2xl shadow-foreground/12';
  }
  if (placement === 'inspector') {
    return 'h-full min-h-0 border-y border-border/60 bg-card/82';
  }
  if (placement === 'console') {
    return 'h-full min-h-0 border border-border/60 bg-background';
  }
  return 'h-full min-h-0 border border-border/60 bg-card/82';
}

export function ObjectCodeSurface({
  object,
  placement = 'sheet',
  onClose,
  className,
  emptyMessage = 'Select an object to view its code.',
  headerActions,
}: ObjectCodeSurfaceProps) {
  const [value, setValue] = useState(object?.document.value ?? '');
  const [pending, setPending] = useState<'save' | 'fork' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectId = object?.id ?? null;

  useEffect(() => {
    setValue(object?.document.value ?? '');
    setError(null);
    setPending(null);
  }, [objectId, object?.document.value]);

  const readOnly = object ? object.document.readOnly === true || !object.onSave : true;
  const document = useMemo(() => {
    if (!object) return null;
    return {
      ...object.document,
      value,
      readOnly,
    };
  }, [object, readOnly, value]);

  const handleChange = useCallback((next: string) => {
    setValue(next);
    object?.onChange?.(next);
  }, [object]);

  const handleSave = useCallback(async (next = value) => {
    if (!object) return;
    if (readOnly || !object.onSave) {
      setError(object.readOnlyReason ?? 'This object is read only.');
      return;
    }
    setPending('save');
    setError(null);
    try {
      await object.onSave(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  }, [object, readOnly, value]);

  const handleFork = useCallback(async () => {
    if (!object?.onFork) return;
    setPending('fork');
    setError(null);
    try {
      await object.onFork(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  }, [object, value]);

  const containerClass = [
    'flex min-h-0 flex-col overflow-hidden text-foreground',
    placementClass(placement),
    className ?? '',
  ].join(' ');

  if (!object || !document) {
    return (
      <aside className={containerClass} data-hudson-code-surface={placement}>
        <div className="flex h-full items-center justify-center p-6 text-center font-mono text-[11px] text-muted-foreground">
          {emptyMessage}
        </div>
      </aside>
    );
  }

  const icon = object.icon ?? <FileCode2 size={13} className="shrink-0 text-cyan-700/70 dark:text-cyan-300/58" />;
  const canFork = Boolean(object.onFork);
  const readOnlyMessage = object.readOnlyReason
    ?? (canFork ? 'This object is protected. Fork it to edit a copy.' : 'This object is read only.');

  return (
    <aside className={containerClass} data-hudson-code-surface={placement}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-card/76 px-3 py-2">
        <span className="flex shrink-0 items-center justify-center">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-foreground/88">{object.title}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {object.subtitle ?? document.uri ?? document.mediaType ?? document.kind}
          </div>
        </div>
        {headerActions}
        {readOnly && canFork && (
          <button
            type="button"
            onClick={handleFork}
            disabled={pending !== null}
            className="flex shrink-0 items-center gap-1 rounded border border-cyan-700/25 bg-cyan-700/10 px-2 py-1.5 text-[10px] font-medium text-cyan-700 transition-colors hover:bg-cyan-700/15 disabled:opacity-45 dark:border-cyan-300/15 dark:bg-cyan-400/10 dark:text-cyan-200"
            title="Create an editable copy"
          >
            <GitBranchPlus size={12} />
            {pending === 'fork' ? 'Forking' : object.forkLabel ?? 'Fork'}
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => void handleSave(value)}
            disabled={pending !== null}
            className="flex shrink-0 items-center gap-1 rounded border border-emerald-700/25 bg-emerald-700/10 px-2 py-1.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-700/15 disabled:opacity-45 dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-200"
            title="Save object code"
          >
            <Save size={12} />
            {pending === 'save' ? 'Saving' : object.saveLabel ?? 'Save'}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            title="Hide code"
            aria-label="Hide code"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-red-700/20 bg-red-700/8 px-3 py-2 font-mono text-[10px] leading-snug text-red-700 dark:border-red-300/15 dark:bg-red-400/8 dark:text-red-200/82">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {readOnly && (
        <div className="shrink-0 border-b border-amber-700/18 bg-amber-700/8 px-3 py-2 text-[10.5px] leading-snug text-amber-800/82 dark:border-amber-300/14 dark:bg-amber-400/8 dark:text-amber-100/72">
          {readOnlyMessage}
        </div>
      )}

      {object.description && (
        <div className="shrink-0 border-b border-border/60 bg-muted/25 px-3 py-2 text-[10.5px] leading-snug text-muted-foreground">
          {object.description}
        </div>
      )}

      <TextDocumentSurface
        key={object.id}
        document={document}
        mode={object.mode ?? (readOnly ? 'read' : 'edit')}
        onChange={handleChange}
        onSave={handleSave}
        showHeader={false}
        className="flex-1 border-0"
      />
    </aside>
  );
}

export function ObjectCodeWorkbench({
  object,
  size,
  onSizeChange,
  onClose,
  chat,
  editorWidth,
  chatWidth,
  onEditorWidthChange,
  onChatWidthChange,
  className,
}: ObjectCodeWorkbenchProps) {
  const [chatOpen, setChatOpen] = useState(Boolean(chat));
  const [localEditorWidth, setLocalEditorWidth] = useState(editorWidth ?? 420);
  const [localChatWidth, setLocalChatWidth] = useState(chatWidth ?? 320);
  const resolvedEditorWidth = editorWidth ?? localEditorWidth;
  const resolvedChatWidth = chatWidth ?? localChatWidth;
  const commitEditorWidth = onEditorWidthChange ?? setLocalEditorWidth;
  const commitChatWidth = onChatWidthChange ?? setLocalChatWidth;
  const sizeClass = size === 'full'
    ? 'w-full'
    : size === 'half'
      ? 'w-[min(56vw,920px)] min-w-[min(520px,100%)]'
      : 'w-[min(44vw,720px)] min-w-[min(420px,100%)]';

  const resizeSplitBy = useCallback((delta: number) => {
    const totalWidth = resolvedEditorWidth + resolvedChatWidth;
    const minEditorWidth = Math.max(EDITOR_MIN_WIDTH, totalWidth - CHAT_MAX_WIDTH);
    const maxEditorWidth = Math.min(EDITOR_MAX_WIDTH, totalWidth - CHAT_MIN_WIDTH);
    const nextEditorWidth = clamp(resolvedEditorWidth + delta, minEditorWidth, maxEditorWidth);
    commitEditorWidth(Math.round(nextEditorWidth));
    commitChatWidth(Math.round(totalWidth - nextEditorWidth));
  }, [commitChatWidth, commitEditorWidth, resolvedChatWidth, resolvedEditorWidth]);

  const handleSplitResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startEditorWidth = resolvedEditorWidth;
    const startChatWidth = resolvedChatWidth;
    const totalWidth = startEditorWidth + startChatWidth;
    const minEditorWidth = Math.max(EDITOR_MIN_WIDTH, totalWidth - CHAT_MAX_WIDTH);
    const maxEditorWidth = Math.min(EDITOR_MAX_WIDTH, totalWidth - CHAT_MIN_WIDTH);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const handleMove = (moveEvent: MouseEvent) => {
      const nextEditorWidth = clamp(startEditorWidth + moveEvent.clientX - startX, minEditorWidth, maxEditorWidth);
      commitEditorWidth(Math.round(nextEditorWidth));
      commitChatWidth(Math.round(totalWidth - nextEditorWidth));
    };

    const handleUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [commitChatWidth, commitEditorWidth, resolvedChatWidth, resolvedEditorWidth]);

  const headerActions = (
    <div className="flex shrink-0 items-center gap-1">
      <WorkbenchSizeButton
        active={size === 'compact'}
        icon={<PanelLeft size={12} />}
        label="Compact code"
        onClick={() => onSizeChange('compact')}
      />
      <WorkbenchSizeButton
        active={size === 'half'}
        icon={<Columns2 size={12} />}
        label="Half screen"
        onClick={() => onSizeChange('half')}
      />
      <WorkbenchSizeButton
        active={size === 'full'}
        icon={<Maximize2 size={12} />}
        label="Full screen"
        onClick={() => onSizeChange('full')}
      />
      {chat && (
        <WorkbenchSizeButton
          active={chatOpen}
          icon={<MessageSquare size={12} />}
          label="Code chat"
          onClick={() => setChatOpen(open => !open)}
        />
      )}
    </div>
  );

  return (
    <section
      className={[
        'pointer-events-auto flex h-full min-h-0 max-w-full overflow-hidden border-r border-border/70 bg-background/96 shadow-2xl shadow-foreground/14',
        sizeClass,
        className ?? '',
      ].join(' ')}
      data-hudson-code-workbench={size}
    >
      <div
        className="min-w-0"
        style={{
          flex: chat && chatOpen ? `1 1 ${resolvedEditorWidth}px` : '1 1 auto',
          width: chat && chatOpen ? `${resolvedEditorWidth}px` : undefined,
        }}
      >
        <ObjectCodeSurface
          object={object}
          placement="workbench"
          onClose={onClose}
          headerActions={headerActions}
          className="h-full border-0 shadow-none"
        />
      </div>
      {chat && chatOpen && object && (
        <>
          <WorkbenchSplitHandle
            onMouseDown={handleSplitResizeStart}
            onKeyboardResize={resizeSplitBy}
          />
          <ObjectCodeChatPanel chat={chat} object={object} width={resolvedChatWidth} />
        </>
      )}
    </section>
  );
}

function WorkbenchSplitHandle({
  onMouseDown,
  onKeyboardResize,
}: {
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyboardResize: (delta: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize code and chat panes"
      tabIndex={0}
      onMouseDown={onMouseDown}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        onKeyboardResize(event.key === 'ArrowLeft' ? -32 : 32);
      }}
      className="group relative z-10 flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-border/20 outline-none transition-colors hover:bg-cyan-700/10 focus-visible:bg-cyan-700/10 dark:hover:bg-cyan-300/10 dark:focus-visible:bg-cyan-300/10"
      data-hudson-code-splitter
    >
      <div className="h-10 w-px bg-border transition-colors group-hover:bg-cyan-700/45 group-focus-visible:bg-cyan-700/45 dark:group-hover:bg-cyan-300/38 dark:group-focus-visible:bg-cyan-300/38" />
    </div>
  );
}

function WorkbenchSizeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded p-1.5 transition-colors ${
        active
          ? 'bg-cyan-700/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function ObjectCodeChatPanel({
  chat,
  object,
  width,
}: {
  chat: HudsonCodeChatSurface;
  object: HudsonCodeObject;
  width: number;
}) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const messages = chat.messages ?? [];
  const working = submitting || chat.status === 'working';

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || !chat.onSubmit || working) return;
    setDraft('');
    setSubmitting(true);
    setLocalError(null);
    try {
      await chat.onSubmit(prompt, object);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSubmitting(false);
    }
  }, [chat, draft, object, working]);

  return (
    <aside
      className="flex h-full min-h-0 shrink-0 flex-col border-l border-border/70 bg-card/76"
      style={{ width }}
      data-hudson-code-chat-panel
    >
      <div className="flex h-[41px] shrink-0 items-center gap-2 border-b border-border/70 px-3">
        <MessageSquare size={13} className="text-cyan-700/70 dark:text-cyan-300/58" />
        <div className="min-w-0 flex-1 truncate text-[11px] font-mono uppercase tracking-[0.16em] text-foreground/82">
          {chat.title ?? 'Code Chat'}
        </div>
        {working && <Loader2 size={13} className="animate-spin text-cyan-700 dark:text-cyan-300" />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 frame-scrollbar">
        {messages.length === 0 ? (
          <div className="rounded border border-border/60 bg-background/45 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            Ask for a code change or inspection. The active object source is the context.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map(message => (
              <div
                key={message.id}
                className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
                  message.role === 'user'
                    ? 'border-cyan-700/20 bg-cyan-700/8 text-foreground/82 dark:border-cyan-300/15 dark:bg-cyan-400/8'
                    : 'border-border/60 bg-background/45 text-muted-foreground'
                }`}
              >
                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                  {message.role}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {(localError || chat.error) && (
        <div className="shrink-0 border-t border-red-700/20 bg-red-700/8 px-3 py-2 font-mono text-[10px] text-red-700 dark:border-red-300/15 dark:bg-red-400/8 dark:text-red-200/82">
          {localError ?? chat.error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border/70 p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={chat.placeholder ?? 'Describe the code turn'}
            className="min-h-[64px] flex-1 resize-none rounded border border-border/70 bg-background/70 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-cyan-700/45 dark:focus:border-cyan-300/35"
            disabled={!chat.onSubmit || working}
          />
          <button
            type="submit"
            disabled={!draft.trim() || !chat.onSubmit || working}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-cyan-700/25 bg-cyan-700/10 text-cyan-700 transition-colors hover:bg-cyan-700/15 disabled:cursor-not-allowed disabled:opacity-40 dark:border-cyan-300/15 dark:bg-cyan-400/10 dark:text-cyan-200"
            title="Send code turn"
            aria-label="Send code turn"
          >
            {working ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </form>
    </aside>
  );
}
