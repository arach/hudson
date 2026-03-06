'use client';

import { useMemo } from 'react';
import { Terminal, MessageSquare, Brain, Wrench, Clock, Zap } from 'lucide-react';
import { useTrace } from './TraceProvider';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
const STATUS_DOT: Record<string, string> = {
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  skipped: 'bg-neutral-500',
};

const TYPE_ICON: Record<string, React.FC<{ size: number; className?: string }>> = {
  tool_call: Wrench,
  message: MessageSquare,
  thinking: Brain,
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const TRACE_STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  completed: { dot: 'bg-emerald-400', label: 'text-emerald-400' },
  running: { dot: 'bg-amber-400', label: 'text-amber-400' },
  failed: { dot: 'bg-red-400', label: 'text-red-400' },
  cancelled: { dot: 'bg-neutral-500', label: 'text-neutral-500' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TraceContent() {
  const { selectedTrace, selectedStepIndex, selectStep, loading } = useTrace();

  const maxDuration = useMemo(() => {
    if (!selectedTrace) return 1;
    return Math.max(1, ...selectedTrace.steps.map(s => s.durationMs));
  }, [selectedTrace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400 font-mono text-[13px]">
        Loading trace...
      </div>
    );
  }

  if (!selectedTrace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
        <Terminal size={28} className="text-neutral-500" />
        <span className="font-mono text-[13px]">Select a trace to view</span>
      </div>
    );
  }

  const st = TRACE_STATUS_STYLES[selectedTrace.status] ?? TRACE_STATUS_STYLES.cancelled;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3.5 border-b border-white/[0.08] space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className="font-mono text-[15px] font-semibold text-white tracking-wide">
            {selectedTrace.name}
          </span>
          <span className={`font-mono text-[11px] uppercase tracking-wider ${st.label}`}>
            {selectedTrace.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-mono text-neutral-400">
          <span className="text-cyan-400">{selectedTrace.agent}</span>
          {selectedTrace.model && <span className="text-neutral-300">{selectedTrace.model}</span>}
          {selectedTrace.totalDurationMs != null && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatMs(selectedTrace.totalDurationMs)}
            </span>
          )}
          {selectedTrace.totalTokens && (
            <span className="flex items-center gap-1">
              <Zap size={11} />
              {(selectedTrace.totalTokens.input + selectedTrace.totalTokens.output).toLocaleString()} tok
            </span>
          )}
          <span>{formatDate(selectedTrace.startedAt)}</span>
        </div>
        {selectedTrace.error && (
          <p className="text-[12px] font-mono text-red-400 truncate">{selectedTrace.error}</p>
        )}
      </div>

      {/* Step timeline */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedTrace.steps.map((step) => {
          const Icon = TYPE_ICON[step.type] ?? Wrench;
          const isSelected = selectedStepIndex === step.index;
          const barWidth = Math.max(2, (step.durationMs / maxDuration) * 100);

          return (
            <button
              key={step.index}
              onClick={() => selectStep(isSelected ? null : step.index)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer border-b border-white/[0.05] ${
                isSelected
                  ? 'bg-cyan-500/[0.10] border-l-2 border-l-cyan-400'
                  : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
              }`}
            >
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[step.status] ?? 'bg-neutral-500'}`} />

              {/* Type icon */}
              <Icon size={13} className="shrink-0 text-neutral-400" />

              {/* Tool name */}
              {step.tool && (
                <span className="shrink-0 font-mono text-[12px] text-cyan-400 min-w-[64px]">
                  {step.tool}
                </span>
              )}

              {/* Summary */}
              <span className="flex-1 font-mono text-[12px] text-neutral-200 truncate">
                {step.summary}
              </span>

              {/* Duration bar */}
              <div className="shrink-0 w-[80px] h-[5px] bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-500/60"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Duration text */}
              <span className="shrink-0 font-mono text-[11px] text-neutral-500 w-[50px] text-right">
                {formatMs(step.durationMs)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
