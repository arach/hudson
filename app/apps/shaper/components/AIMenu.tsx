'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { Sparkles, Square, Trash2, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useShaper } from '../ShaperProvider';
import { SHAPER_AI_ACTIONS } from '../ai-actions';

// ---------------------------------------------------------------------------
// AIMenu — AI button + popover.
//
// The popover is structured into three always-visible zones so the user can
// always tell what state we're in:
//   1. Header strip (state + controls)
//   2. Result card (empty unless the last run produced a report or error)
//   3. Preset list (idle actions)
//   4. Activity log (collapsible, recent tool calls)
// ---------------------------------------------------------------------------
export function AIMenu() {
  const {
    sendAiMessage, aiStatus, aiActivity, aiError, clearAiActivity, stopAi,
    projectImage, bezierData,
  } = useShaper();

  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node) &&
          !popoverRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const busy = aiStatus === 'streaming' || aiStatus === 'submitted';
  const disabled = !projectImage || !bezierData;

  // Derive the most recent report (if any) for the result banner
  const lastReport = useMemo(
    () => [...aiActivity].reverse().find(e => e.level === 'report') ?? null,
    [aiActivity],
  );

  // Derive the most recent error (if any)
  const lastError = useMemo(
    () => [...aiActivity].reverse().find(e => e.level === 'error') ?? null,
    [aiActivity],
  );

  // If busy, show the most recent action row so user sees "what now"
  const currentStep = useMemo(() => {
    if (!busy) return null;
    return [...aiActivity].reverse().find(e => e.level === 'change' || e.level === 'info') ?? null;
  }, [busy, aiActivity]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        disabled={disabled && !busy}
        title={disabled ? 'Load an image first' : 'AI assist — analyze the image and propose trace improvements'}
        className={`flex h-7 items-center justify-center rounded px-2 gap-1 text-[10px] font-bold font-mono transition-all border ${
          busy
            ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-500/40 animate-pulse'
            : disabled
              ? 'bg-neutral-800/30 text-neutral-600 border-neutral-800 cursor-not-allowed'
              : open
                ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/50'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-600/20 hover:text-cyan-200 hover:border-cyan-500/50'
        }`}
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        <span className="tracking-wider">AI</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-9 right-0 z-[60] w-80 rounded-lg border border-neutral-800 bg-neutral-950/98 backdrop-blur-xl shadow-2xl overflow-hidden pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/80 bg-gradient-to-r from-cyan-500/5 to-transparent">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-cyan-400" />
              <span className="text-[11px] font-semibold text-neutral-200">AI assist</span>
              {busy && (
                <span className="flex items-center gap-1 ml-2 text-[9px] text-cyan-300 font-mono">
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                  {currentStep ? `${currentStep.tool}…` : aiStatus}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {busy && stopAi && (
                <button
                  onClick={() => stopAi()}
                  className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                  title="Stop"
                >
                  <Square size={11} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Close"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Result / Error banner — only when we have something to say */}
          {lastError && !busy && (
            <div className="mx-3 mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 flex gap-2">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-red-300 mb-0.5">AI request failed</div>
                <div className="text-[10px] text-red-200/80 font-mono break-words">{lastError.summary}</div>
                <div className="text-[10px] text-neutral-500 mt-1.5">
                  {lastError.summary.toLowerCase().includes('api key')
                    ? 'Set the relevant API key in .env.local or ~/.lattices/inference.json.'
                    : 'Check the console for details, or try a different preset.'}
                </div>
              </div>
            </div>
          )}

          {lastReport && !busy && (
            <div className="mx-3 mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 flex gap-2">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-emerald-300 mb-0.5">Done</div>
                <div className="text-[10px] text-neutral-200 break-words whitespace-pre-wrap">{lastReport.summary}</div>
              </div>
            </div>
          )}

          {!lastReport && !lastError && !busy && (
            <div className="mx-3 mt-3 text-[10px] text-neutral-500 leading-relaxed">
              Pick an action. The model looks at your image plus the current trace and edits via tools — you can watch each change below.
            </div>
          )}

          {/* Presets */}
          <div className="p-2 space-y-0.5">
            <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
              Actions
            </div>
            {SHAPER_AI_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  disabled={busy || disabled}
                  onClick={() => { sendAiMessage(action.prompt, action.label); }}
                  className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon size={13} className={`${action.color} mt-0.5 shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-neutral-200">{action.label}</div>
                    <div className="text-[10px] text-neutral-500 truncate">{action.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Activity log — only surface recent tool calls, collapsible */}
          {aiActivity.length > 0 && (
            <details className="border-t border-neutral-800/80" open={busy}>
              <summary className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/30 cursor-pointer select-none list-none hover:bg-neutral-900/50">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                  Activity ({aiActivity.length})
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearAiActivity(); }}
                  className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Clear activity"
                >
                  <Trash2 size={10} />
                </button>
              </summary>
              <div className="max-h-48 overflow-y-auto px-2 py-1.5 space-y-0.5">
                {aiActivity.slice(-20).map(entry => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ entry }: { entry: { tool: string; summary: string; level: string } }) {
  const { dot, labelColor } =
    entry.level === 'error' ? { dot: 'bg-red-400', labelColor: 'text-red-400' } :
    entry.level === 'report' ? { dot: 'bg-emerald-400', labelColor: 'text-emerald-400' } :
    entry.level === 'change' ? { dot: 'bg-cyan-400', labelColor: 'text-cyan-300' } :
    { dot: 'bg-neutral-600', labelColor: 'text-neutral-500' };
  return (
    <div className="flex items-start gap-2 px-2 py-1 text-[10px] font-mono">
      <span className={`shrink-0 w-1 h-1 rounded-full mt-1.5 ${dot}`} />
      <span className={`shrink-0 w-20 truncate ${labelColor}`}>{entry.tool}</span>
      <span className="text-neutral-400 break-words min-w-0 flex-1">{entry.summary}</span>
    </div>
  );
}
