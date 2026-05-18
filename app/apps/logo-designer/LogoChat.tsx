'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { isToolUIPart, getToolName } from 'ai';
import { AlertCircle, ArrowUpRight, Check, ChevronDown, ChevronRight, Copy, Loader2, Mic, Paperclip, Settings, Square, Trash2 } from 'lucide-react';
import { useVoiceInput } from 'hudsonkit/voice';
import { useLogo } from './LogoProvider';
import type { LogoTemplate } from './types';

const LOGO_CHAT_SESSION_ID = 'logo-app-chat';

/**
 * App-level Chat surface for the Logo Designer.
 *
 * Reads the shared chat instance from `useLogo().aiChat` (the same one matrix
 * Send-to-AI and the trace drawer use) and renders with Logo-aware affordances:
 *
 * - Long user prompts collapse by default (the grounded prompt is huge).
 * - Assistant text gets light markdown rendering (headings, bold, inline code).
 * - Fenced code blocks become collapsible previews — SVG blocks render an
 *   inline thumbnail of the actual markup; JSON gets a one-line summary.
 * - Tool calls/results render as the same collapsible cards the trace uses.
 */
export function LogoChat() {
  const { aiChat, appSettings } = useLogo();

  if (!aiChat) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/70">
        AI chat unavailable.
      </div>
    );
  }

  return <LogoChatSurface aiChat={aiChat} appSettings={appSettings} />;
}

function LogoChatSurface({
  aiChat,
  appSettings,
}: {
  aiChat: NonNullable<ReturnType<typeof useLogo>['aiChat']>;
  appSettings: ReturnType<typeof useLogo>['appSettings'];
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    messages, sendMessage, stop, status, clearChat, error,
    attachments, activeAttachments, toggleAttachment,
  } = aiChat;
  const provider = String(appSettings.aiProvider || 'copilot');
  const model = String(appSettings.aiModel || 'gemini-3-flash-preview');
  const cwd = String(appSettings.homeFolder || '~/hudson/logos');
  const harness = 'api'; // chat surface always goes through /api/ai/chat (not CLI)
  const isStreaming = status === 'streaming' || status === 'submitted';
  const hasAttachments = attachments.length > 0;

  const applyVoiceTranscript = useCallback((transcript: string) => {
    const text = transcript.trim();
    if (!text) return;
    setInput(prev => {
      const existing = prev.trim();
      return existing ? `${existing} ${text}` : text;
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const {
    status: voiceStatus,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    isSupported: isVoiceSupported,
  } = useVoiceInput({
    surface: 'logo-chat',
    metadata: { appId: 'logo-designer', sessionId: LOGO_CHAT_SESSION_ID },
    onTranscript: applyVoiceTranscript,
  });

  const handleVoiceClick = useCallback(() => {
    if (voiceStatus === 'recording') {
      stopVoice();
      return;
    }
    void startVoice();
  }, [startVoice, stopVoice, voiceStatus]);

  const voiceBusy = voiceStatus === 'recording' || voiceStatus === 'transcribing';
  const voiceDisabled = voiceStatus !== 'recording' && (isStreaming || voiceStatus === 'transcribing' || !isVoiceSupported);
  const voiceStatusText = voiceStatus === 'recording'
    ? 'Listening...'
    : voiceStatus === 'transcribing'
      ? 'Transcribing...'
      : voiceError;
  const voiceButtonTitle = !isVoiceSupported
    ? 'Voice input is not supported in this browser'
    : voiceStatus === 'recording'
      ? 'Stop voice input'
      : voiceStatus === 'transcribing'
        ? 'Transcribing...'
        : 'Dictate prompt';

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onSubmit = (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) onSubmit(e);
  };

  return (
    <div className="flex flex-col h-full w-full font-mono text-[12px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto frame-scrollbar p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-muted-foreground/80 text-center py-8 select-none">
            Describe a logo direction, or ask me to iterate on the current variant…
          </div>
        )}

        {messages.map(msg => (
          <ChatBubble key={msg.id} role={msg.role}>
            {(msg.parts ?? []).map((part, i) => {
              if (!part) return null;
              if (part.type === 'text' && typeof part.text === 'string') {
                return <MessageText key={i} text={part.text} role={msg.role} />;
              }
              if (isToolUIPart(part)) {
                return (
                  <ToolBlock
                    key={i}
                    toolName={getToolName(part)}
                    state={String((part as { state?: string }).state ?? '')}
                    input={(part as { input?: unknown }).input}
                    output={(part as { output?: unknown }).output}
                  />
                );
              }
              return null;
            })}
          </ChatBubble>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-muted-foreground">
              <Loader2 size={11} className="inline animate-spin" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-900/20 border-t border-red-500/30 text-red-400 text-[11px] flex items-center gap-2">
          <AlertCircle size={12} />
          <span className="truncate">{error.message || 'An error occurred'}</span>
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-border/50 bg-background/60">
        {hasAttachments && (
          <div className="flex items-center gap-1.5 mb-2">
            <Paperclip size={11} className="text-muted-foreground/80 shrink-0" />
            {attachments.map(att => {
              const isActive = activeAttachments.has(att.label);
              return (
                <button
                  key={att.label}
                  type="button"
                  onClick={() => toggleAttachment(att.label)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                      : 'text-muted-foreground/80 border-border hover:text-foreground hover:border-neutral-600'
                  }`}
                >
                  {att.label}
                </button>
              );
            })}
          </div>
        )}
        {(voiceBusy || voiceError) && (
          <div className={`mb-2 flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] ${
            voiceError
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
              : 'border-accent/25 bg-accent/10 text-muted-foreground'
          }`}>
            <Mic size={11} className={voiceStatus === 'recording' ? 'text-red-500 animate-pulse' : 'text-accent'} />
            <span className="truncate">{voiceStatusText}</span>
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 focus-within:border-accent/40 transition-colors">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => clearChat()}
              className="p-1 rounded text-muted-foreground/80 hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Clear"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={handleVoiceClick}
            disabled={voiceDisabled}
            className={`p-1 rounded transition-colors shrink-0 ${
              voiceStatus === 'recording'
                ? 'text-red-500 bg-red-500/10 hover:bg-red-500/15'
                : 'text-muted-foreground/80 hover:text-accent hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            title={voiceButtonTitle}
            aria-label={voiceButtonTitle}
          >
            <Mic size={12} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe a logo direction, or ask me to iterate on the current variant…"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 caret-accent"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={() => stop()}
              className="p-1.5 rounded text-amber-400 hover:bg-amber-900/20 transition-colors"
              title="Stop"
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="text-[10px] px-2.5 py-1 rounded bg-accent/15 text-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/25 transition-colors"
            >
              Send
            </button>
          )}
        </form>
        <SessionFooter
          sessionId={LOGO_CHAT_SESSION_ID}
          harness={harness}
          provider={provider}
          model={model}
          cwd={cwd}
          messages={messages}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session footer — copy reference for handing off to another agent.
// Shows the essential metadata inline; the share button copies a markdown
// bundle (metadata + full conversation) ready to paste into any AI tool.
// ---------------------------------------------------------------------------

interface SessionFooterProps {
  sessionId: string;
  harness: string;
  provider: string;
  model: string;
  cwd: string;
  messages: Array<{ id: string; role: string; parts?: Array<unknown> }>;
}

function SessionFooter({ sessionId, harness, provider, model, cwd, messages }: SessionFooterProps) {
  const [copied, setCopied] = useState<'meta' | 'all' | null>(null);

  const meta = useMemo(() => [
    ['session', sessionId],
    ['harness', harness],
    ['provider', provider],
    ['model', model],
    ['cwd', cwd],
    ['messages', String(messages.length)],
  ] as const, [sessionId, harness, provider, model, cwd, messages.length]);

  const buildMetadataBlock = () => [
    '# Hudson · Logo Designer chat',
    '',
    ...meta.map(([k, v]) => `- **${k}**: ${v}`),
    `- **captured**: ${new Date().toISOString()}`,
  ].join('\n');

  const buildShareBundle = () => {
    const lines: string[] = [buildMetadataBlock(), '', '---', '', '## Conversation', ''];
    for (const msg of messages) {
      lines.push(`### ${msg.role}`);
      for (const part of (msg.parts ?? [])) {
        const p = part as { type?: string; text?: string; toolName?: string; input?: unknown; output?: unknown; state?: string };
        if (p.type === 'text' && typeof p.text === 'string') {
          lines.push(p.text);
        } else if (isToolUIPart(part as Parameters<typeof isToolUIPart>[0])) {
          const name = getToolName(part as Parameters<typeof getToolName>[0]);
          lines.push('```tool');
          lines.push(`name: ${name}`);
          lines.push(`state: ${String(p.state ?? '')}`);
          if (p.input !== undefined) lines.push(`input: ${JSON.stringify(p.input)}`);
          if (p.output !== undefined) lines.push(`output: ${JSON.stringify(p.output)}`);
          lines.push('```');
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  const copy = async (kind: 'meta' | 'all') => {
    try {
      const text = kind === 'meta' ? buildMetadataBlock() : buildShareBundle();
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard can fail in some contexts — silently ignore */
    }
  };

  const openSettings = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('hudson:open-settings', { detail: { tab: 'settings' } }));
  };

  return (
    <div className="mt-2 flex items-center gap-2 text-[9.5px] font-mono text-muted-foreground/55 overflow-hidden">
      <span className="truncate flex-1 min-w-0">
        <span className="text-muted-foreground/40">{provider}</span>
        <span className="text-muted-foreground/25 mx-1">/</span>
        <span className="text-cyan-300/55">{model}</span>
        <span className="text-muted-foreground/25 mx-2">·</span>
        <span title={`Session: ${sessionId}`}>{sessionId}</span>
        <span className="text-muted-foreground/25 mx-2">·</span>
        <span title={`cwd: ${cwd}`}>{cwd}</span>
      </span>
      <button
        type="button"
        onClick={openSettings}
        className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground/45 hover:text-foreground/70 hover:bg-muted/40 transition-colors"
        title="Open settings (⌘,)"
        aria-label="Open settings"
      >
        <Settings size={11} />
      </button>
      <button
        type="button"
        onClick={() => copy('meta')}
        className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 hover:border-border hover:text-foreground/70 transition-colors"
        title="Copy session metadata only"
      >
        {copied === 'meta' ? <Check size={9} /> : <Copy size={9} />}
        <span className="uppercase tracking-wider">{copied === 'meta' ? 'copied' : 'meta'}</span>
      </button>
      <button
        type="button"
        onClick={() => copy('all')}
        className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/[0.05] text-cyan-300/70 hover:bg-cyan-500/10 hover:text-cyan-200 transition-colors"
        title="Copy full session (metadata + conversation) — paste into Claude/GPT/etc to hand off"
      >
        {copied === 'all' ? <Check size={9} /> : <Copy size={9} />}
        <span className="uppercase tracking-wider">{copied === 'all' ? 'copied' : 'share session'}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble
// ---------------------------------------------------------------------------

function ChatBubble({ role, children }: { role: 'user' | 'assistant' | 'system' | 'data'; children: React.ReactNode }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col gap-1 max-w-[92%]">
        <span
          className={`text-[9px] font-mono uppercase tracking-[0.18em] px-0.5 ${
            isUser ? 'text-accent/70 self-end' : 'text-cyan-300/60 self-start'
          }`}
        >
          {isUser ? 'you' : 'assistant'}
        </span>
        <div
          className={`rounded-lg px-3 py-2 break-words leading-relaxed border ${
            isUser
              ? 'bg-accent/[0.06] text-neutral-50 border-accent/25'
              : 'bg-cyan-500/[0.04] text-neutral-50 border-cyan-500/20'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message text — collapses long user content; markdown-lite for assistant
// ---------------------------------------------------------------------------

const USER_COLLAPSE_THRESHOLD = 240;

function MessageText({ text, role }: { text: string; role: string }) {
  const cleaned = role === 'assistant' ? stripThink(text) : text;
  const isUser = role === 'user';
  const collapsible = isUser && cleaned.length > USER_COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  if (collapsible && !expanded) {
    return (
      <div className="text-[11.5px]">
        <span className="whitespace-pre-wrap">{cleaned.slice(0, USER_COLLAPSE_THRESHOLD)}…</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-1 text-[10px] uppercase tracking-wider text-accent/80 hover:text-accent"
        >
          expand · {cleaned.length.toLocaleString()} chars
        </button>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="text-[11.5px] whitespace-pre-wrap">
        {cleaned}
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground/80"
          >
            collapse
          </button>
        )}
      </div>
    );
  }

  return <Markdown text={cleaned} />;
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ---------------------------------------------------------------------------
// Tiny markdown renderer — splits on ``` fences, parses inline within prose.
// Not a real markdown parser, just covers the patterns the AI emits at us.
// ---------------------------------------------------------------------------

type Segment = { kind: 'prose'; text: string } | { kind: 'code'; lang: string; content: string };

function splitFences(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: 'prose', text: text.slice(lastIndex, match.index) });
    }
    out.push({ kind: 'code', lang: match[1] || 'text', content: match[2] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) out.push({ kind: 'prose', text: text.slice(lastIndex) });
  return out;
}

function Markdown({ text }: { text: string }) {
  const segments = useMemo(() => splitFences(text), [text]);
  return (
    <div className="space-y-1.5 text-[12px] leading-relaxed">
      {segments.map((seg, i) =>
        seg.kind === 'prose'
          ? <Prose key={i} text={seg.text} />
          : <PreviewBlock key={i} lang={seg.lang} content={seg.content} />,
      )}
    </div>
  );
}

function Prose({ text }: { text: string }) {
  // Split by lines; render headings, bullets, and inline formatting.
  const lines = text.split('\n');
  return (
    <div className="whitespace-pre-wrap">
      {lines.map((line, i) => {
        const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
        if (headingMatch) {
          return (
            <div
              key={i}
              className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground/80 mt-2 mb-1"
            >
              {headingMatch[2]}
            </div>
          );
        }
        if (/^\s*[-*]\s+/.test(line)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground/60 shrink-0">·</span>
              <span>{renderInline(line.replace(/^\s*[-*]\s+/, ''))}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, `code`, and __underline__-style emphasis. Done as a single
  // regex split so order is preserved.
  const tokens: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) tokens.push(text.slice(lastIdx, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      tokens.push(<strong key={key++} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else {
      tokens.push(<code key={key++} className="bg-muted/60 text-cyan-300/90 px-1 py-px rounded text-[11px]">{token.slice(1, -1)}</code>);
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) tokens.push(text.slice(lastIdx));
  return tokens;
}

// ---------------------------------------------------------------------------
// PreviewBlock — collapsible code/svg/json with app-specific affordances
// ---------------------------------------------------------------------------

function PreviewBlock({ lang, content }: { lang: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isSvg = lang.toLowerCase() === 'xml' || /^\s*<svg/i.test(content);
  const isJson = lang.toLowerCase() === 'json';

  // Choose a one-line preview headline based on the content kind.
  let headline: React.ReactNode;
  if (isSvg) {
    const sizeMatch = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(content);
    const w = sizeMatch?.[1];
    const h = sizeMatch?.[2];
    headline = (
      <span className="flex items-center gap-2">
        <span className="text-emerald-300/90">svg</span>
        {w && h && <span className="text-muted-foreground/55">{w}×{h}</span>}
        <span className="text-muted-foreground/55">{content.length.toLocaleString()} chars</span>
      </span>
    );
  } else if (isJson) {
    let summary = '';
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        summary = Array.isArray(parsed) ? `[${parsed.length} items]` : `{${Object.keys(parsed).join(', ')}}`;
      }
    } catch { summary = '(invalid)'; }
    headline = (
      <span className="flex items-center gap-2">
        <span className="text-amber-300/90">json</span>
        <span className="text-muted-foreground/70 truncate max-w-[40ch]">{summary}</span>
      </span>
    );
  } else {
    const first = content.split('\n')[0]?.trim().slice(0, 80) ?? '';
    headline = (
      <span className="flex items-center gap-2">
        <span className="text-cyan-300/90">{lang || 'code'}</span>
        <span className="text-muted-foreground/55 truncate max-w-[40ch]">{first}</span>
      </span>
    );
  }

  return (
    <div className="rounded border border-border/50 bg-background/40 my-1.5">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-foreground/[0.02]"
      >
        {expanded ? <ChevronDown size={11} className="opacity-60 shrink-0" /> : <ChevronRight size={11} className="opacity-60 shrink-0" />}
        <span className="font-mono text-[10.5px] uppercase tracking-wider flex-1 min-w-0">
          {headline}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/40">
          {isSvg && (
            <div className="flex items-center justify-center bg-neutral-950/50 p-3">
              <div
                className="rounded bg-card border border-border/40 p-1.5"
                style={{ width: 96, height: 96 }}
                dangerouslySetInnerHTML={{ __html: scaleSvgPreview(content, 84) }}
                suppressHydrationWarning
              />
            </div>
          )}
          <pre className="text-[10.5px] font-mono leading-snug px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[260px] overflow-y-auto frame-scrollbar text-foreground/85">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function scaleSvgPreview(svg: string, size: number): string {
  // Force the preview SVG to fit the target box regardless of source dims.
  return svg
    .replace(/<svg\b([^>]*?)\swidth="[^"]*"/, '<svg$1')
    .replace(/<svg\b([^>]*?)\sheight="[^"]*"/, '<svg$1')
    .replace(/<svg\b/, `<svg width="${size}" height="${size}"`);
}

// ---------------------------------------------------------------------------
// Tool call/result block — mirrors the trace drawer style for visual continuity
// ---------------------------------------------------------------------------

function ToolBlock({ toolName, state, input, output }: { toolName: string; state: string; input: unknown; output: unknown }) {
  const { templates, setVariant, setView } = useLogo();
  const [expanded, setExpanded] = useState(false);
  const inputStr = input !== undefined ? JSON.stringify(input, null, 2) : null;
  const outputStr = output !== undefined ? JSON.stringify(output, null, 2) : null;
  const inputPreview = inputStr ? inputStr.replace(/\s+/g, ' ').slice(0, 90) : null;
  const done = state === 'output-available' || state === 'result';
  const errored = state === 'output-error';

  // For create_template tool calls that landed, surface a thumbnail + open
  // link in-context so the user can jump to the finished product without
  // hunting in the variants list.
  const matchedTemplate = useMemo<LogoTemplate | null>(() => {
    if (toolName !== 'create_template' || !done) return null;
    const args = (input ?? {}) as { name?: string };
    if (!args.name) return null;
    // Search from end — most recent templates first (handles repeat names).
    for (let i = templates.length - 1; i >= 0; i--) {
      if (templates[i].name === args.name) return templates[i];
    }
    return null;
  }, [toolName, done, input, templates]);

  const openTemplate = () => {
    if (!matchedTemplate) return;
    // Order matters: switch view first so the canvas is in preview mode when
    // the variant change lands, then dismiss the drawer so the result is the
    // hero of the workspace.
    setView('preview');
    setVariant(matchedTemplate.id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hudson:close-terminal'));
      window.dispatchEvent(new CustomEvent('hudson:logo-spotlight', { detail: { templateId: matchedTemplate.id } }));
    }
  };

  return (
    <div className={`rounded border ${errored ? 'border-red-500/30 bg-red-500/5' : done ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-cyan-500/25 bg-cyan-500/5'} px-2 py-1 my-1`}>
      <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1.5 w-full text-left">
        {expanded ? <ChevronDown size={11} className="opacity-60 shrink-0" /> : <ChevronRight size={11} className="opacity-60 shrink-0" />}
        <span className={`font-mono text-[10.5px] ${errored ? 'text-red-300' : done ? 'text-emerald-300' : 'text-cyan-300'}`}>{toolName}</span>
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/60 shrink-0">{state}</span>
        {!expanded && inputPreview && (
          <span className="font-mono text-[10px] text-muted-foreground/65 truncate ml-1">{inputPreview}</span>
        )}
      </button>
      {matchedTemplate && (
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/30">
          <TemplateThumb template={matchedTemplate} size={36} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] text-foreground/90 truncate">{matchedTemplate.name}</div>
            {matchedTemplate.description && (
              <div className="font-mono text-[9.5px] text-muted-foreground/70 truncate">{matchedTemplate.description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={openTemplate}
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[9.5px] font-mono uppercase tracking-wider hover:bg-emerald-500/20 transition-colors"
            title="Set as active variant and switch to preview"
          >
            Open
            <ArrowUpRight size={9} />
          </button>
        </div>
      )}
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {inputStr && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">input</div>
              <pre className="text-[10px] font-mono bg-background/40 rounded p-1.5 overflow-x-auto leading-snug whitespace-pre-wrap break-all max-h-[180px] overflow-y-auto">{inputStr}</pre>
            </div>
          )}
          {outputStr && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">output</div>
              <pre className="text-[10px] font-mono bg-background/40 rounded p-1.5 overflow-x-auto leading-snug whitespace-pre-wrap break-all max-h-[180px] overflow-y-auto">{outputStr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini SVG thumb for the create_template "Open" affordance.
function TemplateThumb({ template, size }: { template: LogoTemplate; size: number }) {
  const html = useMemo(() => {
    try {
      const defaults: Record<string, unknown> = {};
      for (const p of template.params ?? []) defaults[p.key] = p.default;
      const fn = new Function('p', 'vb', template.renderBody);
      const inner = fn(defaults, 256);
      return typeof inner === 'string' ? inner : '';
    } catch {
      return '';
    }
  }, [template]);
  return (
    <div className="shrink-0 rounded bg-card border border-border/40 overflow-hidden" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 256 256"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
