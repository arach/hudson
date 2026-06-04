'use client';

import { Search, Loader2, Download, ImageIcon, ArrowRight, Trash2, Clock } from 'lucide-react';
import { useWebFetch } from './WebFetchProvider';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function WebFetchContent() {
  const { url, setUrl, result, loading, error, fetchImage, history, clearHistory } = useWebFetch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await fetchImage();
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL input */}
      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste image URL"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted/40 border border-border/60 text-[13px] text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-accent/50 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-4 py-2 rounded-lg bg-accent/10 text-accent text-[12px] font-medium hover:bg-accent/20 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Fetch
          </button>
        </div>
      </form>

      {error && (
        <div className="px-4 py-2 text-[11px] text-destructive bg-destructive/10 border-b border-destructive/20">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {result ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-center rounded-xl bg-muted/40 border border-border/60 p-6 min-h-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.dataUrl}
                alt="Fetched"
                className="max-w-full max-h-[400px] object-contain rounded"
              />
            </div>

            <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><ImageIcon size={10} /> {result.contentType}</span>
              <span>{formatSize(result.size)}</span>
            </div>

            <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
              {result.sourceUrl}
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-[10px] text-accent">
              <ArrowRight size={11} />
              <span>Click the pipe arrow to send to Shaper</span>
            </div>
          </div>
        ) : !loading && (
          <>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <ImageIcon size={32} className="text-muted-foreground/40 mb-3" />
                <div className="text-[12px] text-muted-foreground mb-1">Fetch an image from the web</div>
                <div className="text-[10px] text-muted-foreground/70">Paste a URL and hit Fetch</div>
              </div>
            ) : (
              <div className="px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                    <Clock size={9} />
                    Recent fetches
                  </div>
                  <button
                    onClick={clearHistory}
                    className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                    title="Clear history"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {history.map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => { setUrl(entry.url); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground truncate transition-colors">
                          {entry.url}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground/70 mt-0.5">
                          <span>{entry.contentType}</span>
                          <span>·</span>
                          <span>{formatSize(entry.size)}</span>
                          <span>·</span>
                          <span>{timeAgo(entry.fetchedAt)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
