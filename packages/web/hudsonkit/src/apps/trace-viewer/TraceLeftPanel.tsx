'use client';

import { Clock } from 'lucide-react';
import { useTrace } from './TraceProvider';

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-success',
  running: 'bg-warning animate-pulse',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground',
};

export function TraceLeftPanel() {
  const { traces, selectedTraceId, setSelectedTraceId } = useTrace();

  if (traces.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-[13px]">
        No traces found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {traces.map((t) => {
        const isSelected = selectedTraceId === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setSelectedTraceId(isSelected ? null : t.id)}
            className={`w-full flex flex-col gap-1.5 px-3 py-3 text-left transition-colors cursor-pointer border-b border-border/60 ${
              isSelected
                ? 'bg-accent/10'
                : 'hover:bg-muted/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? 'bg-muted-foreground'}`} />
              <span className={`font-mono text-[13px] truncate ${
                isSelected ? 'text-foreground' : 'text-foreground'
              }`}>
                {t.name}
              </span>
            </div>
            <div className="flex items-center gap-2.5 pl-4">
              <span className="font-mono text-[11px] text-info/90 bg-info/10 px-1.5 py-0.5 rounded">
                {t.agent}
              </span>
              {t.totalDurationMs != null && (
                <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <Clock size={10} />
                  {formatMs(t.totalDurationMs)}
                </span>
              )}
              <span className="font-mono text-[11px] text-muted-foreground">
                {t.stepCount} steps
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
