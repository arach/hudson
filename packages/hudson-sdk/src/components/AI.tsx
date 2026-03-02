'use client';

import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Square, Trash2, AlertCircle, Paperclip } from 'lucide-react';
import type { HudsonAIChat } from '../hooks/useHudsonAI';

interface AIProps {
  chat: HudsonAIChat;
  placeholder?: string;
}

export function AI({ chat, placeholder = 'Ask AI...' }: AIProps) {
  const {
    messages, sendMessage, stop, status, setMessages, error,
    attachments, activeAttachments, toggleAttachment,
  } = chat;
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isStreaming = status === 'streaming' || status === 'submitted';
  const hasAttachments = attachments.length > 0;

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage({ text });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Stop all key events from bubbling to shell handlers (e.g. space → canvas pan)
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full font-mono text-[12px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto frame-scrollbar p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-neutral-500 text-center py-8 select-none">
            {placeholder}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20'
                  : 'bg-neutral-800/50 text-neutral-200 border border-neutral-700/50'
              }`}
            >
              {msg.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <span key={i}>{part.text}</span>;
                }
                // Tool parts have type "tool-<name>" in AI SDK v6
                if (part.type.startsWith('tool-')) {
                  const p = part as { type: string; toolCallId: string; input?: unknown };
                  const toolName = p.type.replace(/^tool-/, '');
                  const argStr = Object.entries((p.input ?? {}) as Record<string, unknown>)
                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                    .join(', ');
                  return (
                    <div key={i} className="text-[11px] text-cyan-400/70 mt-1 font-mono">
                      <span className="text-neutral-500">{'↳ '}</span>
                      {toolName}({argStr})
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 py-2 text-neutral-400">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border-t border-red-500/30 text-red-400 text-[11px] flex items-center gap-2">
          <AlertCircle size={12} />
          <span className="truncate">{error.message || 'An error occurred'}</span>
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 py-2.5 border-t border-neutral-700/50 bg-neutral-900/50">
        {/* Attachment toggles */}
        {hasAttachments && (
          <div className="flex items-center gap-1.5 mb-2">
            <Paperclip size={11} className="text-neutral-500 shrink-0" />
            {attachments.map((att) => {
              const isActive = activeAttachments.has(att.label);
              return (
                <button
                  key={att.label}
                  type="button"
                  onClick={() => toggleAttachment(att.label)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                      : 'text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:border-neutral-600'
                  }`}
                >
                  {att.label}
                </button>
              );
            })}
            {activeAttachments.size > 0 && (
              <span className="text-[10px] text-neutral-600 ml-1">attached</span>
            )}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 focus-within:border-emerald-500/40 transition-colors">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors"
              title="Clear"
            >
              <Trash2 size={12} />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-neutral-100 placeholder:text-neutral-500 caret-emerald-400"
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
              className="text-[11px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
