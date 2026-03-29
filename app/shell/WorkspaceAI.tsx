'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Sparkles, Loader2, Bot, ImageIcon, X, Camera } from 'lucide-react';
import Markdown from 'react-markdown';
import { useHudsonAI } from '@hudson/sdk';
import type { HudsonWorkspace } from '@hudson/sdk';
import { useDataBus } from './DataBusContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileAttachment {
  id: string;
  name: string;
  mediaType: string;
  /** Data URL for sending to the AI model */
  dataUrl: string;
  /** Blob URL for efficient preview rendering (falls back to dataUrl) */
  previewUrl: string;
}

interface WorkspaceAIProps {
  workspace: HudsonWorkspace;
  /** Callback to execute tool calls against app state */
  onToolCall: (name: string, args: Record<string, unknown>) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Capture the visible workspace as a blob + data URL via html2canvas. */
async function captureWorkspace(): Promise<{ blobUrl: string; dataUrl: string } | null> {
  try {
    // Target the top-level app page — the outermost element with actual dimensions
    const target = document.getElementById('__next') ?? document.body;

    const mod = await import('html2canvas-pro');
    const html2canvas = mod.default ?? mod;

    const canvas = await (html2canvas as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>)(target, {
      backgroundColor: '#0a0a0a',
      scale: 0.5,               // half-res to keep the file manageable
      useCORS: true,
      logging: false,
      allowTaint: true,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size < 200) { console.warn('[WorkspaceAI] capture produced empty blob'); return null; }

    const blobUrl = URL.createObjectURL(blob);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    console.log('[WorkspaceAI] captured', canvas.width, 'x', canvas.height, '→', Math.round(blob.size / 1024), 'KB');
    return { blobUrl, dataUrl };
  } catch (e) {
    console.error('[WorkspaceAI] screenshot failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceAI({ workspace, onToolCall }: WorkspaceAIProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pipes, getPortCatalog } = useDataBus();

  const context = useMemo(() => ({
    apps: workspace.apps.map(c => ({
      id: c.app.id,
      name: c.app.name,
      ports: c.app.ports,
    })),
    pipes: pipes.filter(p => p.source?.appId).map(p => ({
      name: p.name,
      source: p.source,
      sink: p.sink,
    })),
    portCatalog: getPortCatalog(),
  }), [workspace, pipes, getPortCatalog]);

  const chat = useHudsonAI({
    toolset: 'workspace',
    context,
    provider: 'copilot',
    model: 'gemini-3-flash-preview',
    onToolCall: async (name, args) => {
      console.log('[WorkspaceAI] tool call:', name, args);
      await onToolCall(name, args);
    },
  });

  // ── Add attachment from file ────────────────────────────────────────
  const addFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await fileToDataUrl(file);
    const previewUrl = URL.createObjectURL(file);
    setAttachments(prev => [...prev, {
      id: generateId(),
      name: file.name,
      mediaType: file.type,
      dataUrl,
      previewUrl,
    }]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const removed = prev.find(a => a.id === id);
      if (removed && removed.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(a => a.id !== id);
    });
  }, []);

  // ── Workspace screenshot ────────────────────────────────────────────
  const handleSnapshot = useCallback(async () => {
    setSnapping(true);
    try {
      const result = await captureWorkspace();
      if (result) {
        setAttachments(prev => [...prev, {
          id: generateId(),
          name: `snap-${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace('/', '')}-${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(':', '')}.jpg`,
          mediaType: 'image/jpeg',
          dataUrl: result.dataUrl,
          previewUrl: result.blobUrl,
        }]);
      }
    } finally {
      setSnapping(false);
    }
  }, []);

  // ── Submit with attachments ─────────────────────────────────────────
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const hasText = input.trim().length > 0;
    const hasFiles = attachments.length > 0;
    if ((!hasText && !hasFiles) || chat.status === 'streaming') return;

    const files = attachments.map(a => ({
      type: 'file' as const,
      mediaType: a.mediaType,
      url: a.dataUrl,
      filename: a.name,
    }));

    chat.sendMessage(
      files.length > 0
        ? { text: input.trim() || 'What do you see?', files }
        : { text: input.trim() },
    );
    setInput('');
    setAttachments([]);
  }, [input, attachments, chat]);

  // ── Drag & drop ─────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) await addFile(file);
  }, [addFile]);

  // ── Paste ───────────────────────────────────────────────────────────
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await addFile(file);
        return;
      }
    }
  }, [addFile]);

  // Generated images (from tool calls)
  const [generatedImages, setGeneratedImages] = useState<Array<{ dataUrl: string; prompt: string }>>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.dataUrl) {
        setGeneratedImages(prev => [...prev, { dataUrl: detail.dataUrl, prompt: detail.prompt }]);
      }
    };
    window.addEventListener('hudson:generated-image', handler);
    return () => window.removeEventListener('hudson:generated-image', handler);
  }, []);

  // Auto-scroll on new messages or generated images
  const messages = chat.messages ?? [];
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, generatedImages.length]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="flex flex-col h-full bg-neutral-950"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Bot size={13} className={chat.status === 'submitted' || chat.status === 'streaming' ? 'text-cyan-400 animate-pulse' : 'text-cyan-400/50'} />
        <span className="text-[11px] font-mono text-white/50">Hudson AI</span>
        {(chat.status === 'submitted' || chat.status === 'streaming') && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        )}
        <span className="text-[9px] font-mono text-white/20 ml-auto">workspace</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto frame-scrollbar px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-[11px] text-white/15 text-center mt-8">
            Ask me anything about the workspace — I can adjust params, push pipes, create templates, and more.
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const textParts = (msg.parts ?? []).filter((p: Record<string, unknown>) => p.type === 'text');
          const fileParts = (msg.parts ?? []).filter((p: Record<string, unknown>) => p.type === 'file');
          const text = textParts.map((p: Record<string, unknown>) => String(p.text ?? '')).join('');
          const display = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

          if (!display && fileParts.length === 0) return null;

          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                isUser
                  ? 'bg-cyan-500/10 text-white/70 border border-cyan-500/15'
                  : 'bg-white/[0.03] text-white/60 border border-white/[0.05]'
              }`}>
                {/* Attached images */}
                {fileParts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {fileParts.map((p: Record<string, unknown>, j: number) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={j}
                        src={p.url as string}
                        alt={(p.filename as string) ?? 'attachment'}
                        className="max-w-[120px] max-h-[80px] rounded border border-white/[0.08] object-contain"
                      />
                    ))}
                  </div>
                )}
                {display && (isUser
                  ? <span>{display}</span>
                  : <div className="hudson-ai-md"><Markdown>{display}</Markdown></div>
                )}
              </div>
            </div>
          );
        })}

        {/* Generated images from tool calls */}
        {generatedImages.map((gi, idx) => (
          <div key={`gen-${idx}`} className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.05]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gi.dataUrl}
                alt={gi.prompt}
                className="max-w-full rounded border border-white/[0.08]"
              />
              <div className="text-[9px] text-white/20 mt-1.5 truncate font-mono">{gi.prompt}</div>
            </div>
          </div>
        ))}

        {(chat.status === 'submitted' || chat.status === 'streaming') && (
          <div className="flex items-start gap-2.5 py-1">
            <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={10} className="text-cyan-400 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-cyan-400/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <span className="w-1 h-1 rounded-full bg-cyan-400/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="w-1 h-1 rounded-full bg-cyan-400/20 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
                <span className="text-[10px] text-cyan-400/40 font-mono">
                  {chat.status === 'submitted' ? 'Thinking' : 'Writing'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t border-white/[0.04] flex items-center gap-2 overflow-x-auto">
          {attachments.map(a => (
            <div key={a.id} className="relative group shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.previewUrl}
                alt={a.name}
                className="h-12 rounded border border-white/[0.08] object-contain"
              />
              <button
                onClick={() => removeAttachment(a.id)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} className="text-white/60" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white/40 px-1 truncate rounded-b">
                {a.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/[0.06]">
        <div className="flex gap-2 items-center">
          {/* Snapshot button */}
          <button
            type="button"
            onClick={handleSnapshot}
            disabled={snapping}
            className="p-2 rounded-lg text-white/20 hover:text-cyan-400/60 hover:bg-white/[0.04] disabled:opacity-30 transition-colors"
            title="Capture workspace screenshot"
          >
            {snapping ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          {/* File picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-white/20 hover:text-cyan-400/60 hover:bg-white/[0.04] transition-colors"
            title="Attach image"
          >
            <ImageIcon size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async e => {
              const files = Array.from(e.target.files ?? []);
              for (const f of files) await addFile(f);
              e.target.value = '';
            }}
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            onPaste={handlePaste}
            placeholder="Ask Hudson anything..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/30 transition-colors"
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || chat.status === 'streaming'}
            className="px-3 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            {chat.status === 'streaming' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      </form>

      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-cyan-500/5 border-2 border-dashed border-cyan-500/30 rounded-lg backdrop-blur-sm pointer-events-none">
          <div className="text-[13px] text-cyan-400/60 font-medium flex items-center gap-2">
            <ImageIcon size={16} />
            Drop to attach
          </div>
        </div>
      )}
    </div>
  );
}
