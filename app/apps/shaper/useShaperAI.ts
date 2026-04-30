'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useHudsonAI } from 'hudsonkit';
import type { TraceOptions, ProjectImage, TraceInfo } from './types';

// ---------------------------------------------------------------------------
// Options passed by ShaperProvider — all the setters the model needs to reach.
// ---------------------------------------------------------------------------
export interface UseShaperAIOptions {
  projectImage: ProjectImage | null;
  traceOptions: TraceOptions;
  traceInfo: TraceInfo | null;
  setTraceOptions: React.Dispatch<React.SetStateAction<TraceOptions>>;
  handleRetrace: () => Promise<void>;
  toggleStrokeVisibility: (index: number) => void;
  deleteStroke: (index: number) => void;
  strokeSummaries: Array<{
    index: number;
    segments: number;
    name: string | null;
    bbox: { x: number; y: number; width: number; height: number };
    hidden: boolean;
  }>;
  provider?: string;
  model?: string;
}

export interface AiActivityEntry {
  id: string;
  tool: string;
  summary: string;
  timestamp: number;
  level: 'info' | 'change' | 'report' | 'error';
}

// Monotonic-ish unique ID that survives HMR without colliding with stale state.
// Combines a time prefix with a random suffix — cheaper than crypto.randomUUID
// and unique enough for an activity log.
function nextActivityId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useShaperAI(opts: UseShaperAIOptions) {
  const {
    projectImage, traceOptions, traceInfo, setTraceOptions, handleRetrace,
    toggleStrokeVisibility, deleteStroke, strokeSummaries,
    provider, model,
  } = opts;

  const [activity, setActivity] = useState<AiActivityEntry[]>([]);
  const logActivity = useCallback(
    (tool: string, summary: string, level: AiActivityEntry['level'] = 'info') => {
      setActivity(prev => [...prev.slice(-19), {
        id: nextActivityId(), tool, summary, timestamp: Date.now(), level,
      }]);
    },
    [],
  );

  const clearActivity = useCallback(() => setActivity([]), []);

  // Context snapshot — sent with each request so the model sees current state
  const context = useMemo(() => ({
    traceOptions,
    traceInfo,
    strokes: strokeSummaries,
    projectImage: projectImage ? {
      name: projectImage.name,
      width: projectImage.width,
      height: projectImage.height,
    } : null,
  }), [traceOptions, traceInfo, strokeSummaries, projectImage]);

  const chat = useHudsonAI({
    toolset: 'shaper',
    context,
    // Respect the user's global AI mode (api / cli). File attachments are
    // added conditionally in sendAiMessage based on resolved mode.
    provider: provider ?? 'minimax',
    model: model ?? 'MiniMax-M2.7',
    onFinish: (event) => {
      const { finishReason, message } = event as { finishReason?: string; message?: { parts?: Array<{ type: string; text?: string }> } };
      console.log('[shaper-ai] stream finished:', finishReason, message);

      // Surface the model's text response when nothing actionable happened.
      // Otherwise the popover goes silent even though the model replied.
      const toolCalls = message?.parts?.filter(p => p.type?.startsWith('tool-')) ?? [];
      const textParts = message?.parts?.filter(p => p.type === 'text' && p.text) ?? [];
      if (toolCalls.length === 0) {
        const text = textParts.map(p => p.text).join(' ').trim();
        if (text) {
          logActivity('model', text.slice(0, 300), 'report');
        } else {
          logActivity('finish', `no tool calls (reason: ${finishReason ?? '?'})`, 'error');
        }
      }
    },
    onError: (err) => {
      console.error('[shaper-ai] stream error:', err);
      const message = err instanceof Error
        ? (err.message || err.toString() || 'Request failed with no body — check dev server terminal for ai/chat: ERROR line')
        : String(err);
      logActivity('error', message, 'error');
    },
    onToolCall: async (name, args) => {
      console.log('[shaper-ai] tool call:', name, args);
      try {
        switch (name) {
          case 'set_trace_options': {
            const patch: Partial<TraceOptions> = {};
            if (args.edgeDetection != null) patch.edgeDetection = args.edgeDetection as TraceOptions['edgeDetection'];
            if (args.errorTolerance != null) patch.errorTolerance = Number(args.errorTolerance);
            if (args.maxContours != null) patch.maxContours = Number(args.maxContours);
            if (args.resolution != null) patch.resolution = args.resolution as TraceOptions['resolution'];
            if (Object.keys(patch).length === 0) {
              logActivity('set_trace_options', 'no-op (empty patch)', 'info');
              break;
            }
            setTraceOptions(prev => ({ ...prev, ...patch }));
            const changes = Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', ');
            logActivity('set_trace_options', changes, 'change');
            break;
          }
          case 'retrace': {
            logActivity('retrace', String(args.reason ?? 'retracing...'), 'change');
            await handleRetrace();
            break;
          }
          case 'hide_stroke': {
            const index = Number(args.index);
            toggleStrokeVisibility(index);
            logActivity('hide_stroke', `#${index} — ${args.reason ?? ''}`.trim(), 'change');
            break;
          }
          case 'delete_stroke': {
            const index = Number(args.index);
            deleteStroke(index);
            logActivity('delete_stroke', `#${index} — ${args.reason ?? ''}`.trim(), 'change');
            break;
          }
          case 'report': {
            const summary = String(args.summary ?? '');
            const confidence = String(args.confidence ?? 'med');
            logActivity('report', `[${confidence}] ${summary}`, 'report');
            break;
          }
          default:
            logActivity('unknown', `ignored tool "${name}"`, 'info');
        }
      } catch (err) {
        console.error('[useShaperAI] tool error:', name, err);
        logActivity('error', `${name}: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    },
  });

  // Surface errors from the stream into the activity log
  const chatError = chat?.error;
  useEffect(() => {
    if (chatError) logActivity('error', String(chatError).slice(0, 120), 'error');
  }, [chatError, logActivity]);

  /**
   * Kick off an AI turn. `text` is the preset prompt; `label` is the user-visible
   * name shown in the activity log (e.g. "Enhance").
   *
   * Image attachment: only added in `api` mode — the CLI relay only consumes
   * text parts and barfs on file parts. In CLI mode the model still has the
   * stroke summaries and trace info in the textual context, which is enough
   * for most presets.
   */
  const sendAiMessage = useCallback((text: string, label?: string) => {
    if (!chat) return;
    logActivity('start', label ?? 'Running…', 'info');
    const canAttachImage = chat.mode === 'api' && !!projectImage?.url;
    try {
      if (canAttachImage && projectImage) {
        chat.sendMessage({
          text,
          files: [{
            type: 'file',
            mediaType: guessImageMediaType(projectImage),
            url: projectImage.url,
            filename: projectImage.name,
          }],
        });
      } else {
        chat.sendMessage({ text });
      }
    } catch (err) {
      logActivity('error', err instanceof Error ? err.message : String(err), 'error');
    }
  }, [chat, projectImage, logActivity]);

  return {
    sendAiMessage,
    aiStatus: chat?.status ?? 'ready',
    aiMessages: chat?.messages ?? [],
    aiActivity: activity,
    aiError: chatError ? String(chatError) : null,
    clearAiActivity: clearActivity,
    stopAi: chat?.stop,
  };
}

// Data URLs carry their own mime; external URLs we best-guess from the extension.
function guessImageMediaType(img: ProjectImage): string {
  if (img.url.startsWith('data:')) {
    const m = img.url.match(/^data:([^;,]+)/);
    if (m) return m[1];
  }
  const name = (img.name ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}
