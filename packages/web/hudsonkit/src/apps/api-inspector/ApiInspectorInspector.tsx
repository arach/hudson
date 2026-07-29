'use client';

import { Trash2, Zap, FileText } from '../../icons';
import { useApiInspector } from './ApiInspectorProvider';
import { METHOD_COLORS, getStatusColor, formatMs, formatBytes } from './types';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 27) + '...' : u.pathname;
    return u.host + path;
  } catch {
    return url.length > 40 ? url.slice(0, 37) + '...' : url;
  }
}

// ---------------------------------------------------------------------------
// Response Details Section
// ---------------------------------------------------------------------------

function ResponseDetails() {
  const { response } = useApiInspector();
  if (!response) return null;

  return (
    <div className="px-3 py-3 border-b border-border/40">
      <div className="text-[10px] font-medium text-foreground/30 uppercase tracking-wider mb-2">Response</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground/30">Status</span>
          <span className={`text-[12px] font-mono font-bold ${getStatusColor(response.status)}`}>
            {response.status} {response.statusText}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground/30">Duration</span>
          <span className="text-[12px] font-mono text-foreground/60 flex items-center gap-1.5">
            <Zap size={10} className="text-amber-700/70 dark:text-amber-400/50" />
            {formatMs(response.timing.durationMs)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground/30">Size</span>
          <span className="text-[12px] font-mono text-foreground/60 flex items-center gap-1.5">
            <FileText size={10} className="text-cyan-700/70 dark:text-cyan-400/50" />
            {formatBytes(response.size)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground/30">Type</span>
          <span className="text-[12px] font-mono text-foreground/40">{response.bodyType}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground/30">Headers</span>
          <span className="text-[12px] font-mono text-foreground/40">{Object.keys(response.headers).length}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Section
// ---------------------------------------------------------------------------

function HistorySection() {
  const { history, loadFromHistory, deleteHistoryEntry, clearHistory } = useApiInspector();

  if (history.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[11px] text-foreground/15">
        No request history yet
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-medium text-foreground/30 uppercase tracking-wider">History</div>
        <button
          onClick={clearHistory}
          className="text-[10px] text-foreground/15 hover:text-red-400/50 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
        {history.map(entry => (
          <div
            key={entry.id}
            className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer transition-colors"
            onClick={() => loadFromHistory(entry)}
          >
            <span className={`text-[10px] font-mono font-bold shrink-0 w-[36px] ${METHOD_COLORS[entry.request.method]}`}>
              {entry.request.method.slice(0, 4)}
            </span>
            <span className="text-[11px] text-foreground/40 font-mono truncate flex-1">
              {shortenUrl(entry.request.url)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {entry.response ? (
                <span className={`text-[10px] font-mono ${getStatusColor(entry.response.status)}`}>
                  {entry.response.status}
                </span>
              ) : entry.error ? (
                <span className="text-[10px] text-red-700/70 dark:text-red-400/60">err</span>
              ) : null}
              <span className="text-[10px] text-foreground/15">{timeAgo(entry.timestamp)}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteHistoryEntry(entry.id); }}
                className="opacity-0 group-hover:opacity-100 text-foreground/10 hover:text-red-400/50 transition-all"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

export function ApiInspectorInspector() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <ResponseDetails />
      <HistorySection />
    </div>
  );
}
