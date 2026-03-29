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
      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste image URL..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/30 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-[12px] font-medium hover:bg-cyan-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Fetch
          </button>
        </div>
      </form>

      {error && (
        <div className="px-4 py-2 text-[11px] text-red-400 bg-red-500/10 border-b border-red-500/20">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {result ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 min-h-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.dataUrl}
                alt="Fetched"
                className="max-w-full max-h-[400px] object-contain rounded"
              />
            </div>

            <div className="flex items-center gap-4 text-[10px] font-mono text-white/30">
              <span className="flex items-center gap-1"><ImageIcon size={10} /> {result.contentType}</span>
              <span>{formatSize(result.size)}</span>
            </div>

            <div className="text-[10px] font-mono text-white/20 truncate">
              {result.sourceUrl}
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-[10px] text-cyan-400/60">
              <ArrowRight size={11} />
              <span>Click the pipe arrow to send to Shaper</span>
            </div>
          </div>
        ) : !loading && (
          <>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <ImageIcon size={32} className="text-white/8 mb-3" />
                <div className="text-[12px] text-white/25 mb-1">Fetch an image from the web</div>
                <div className="text-[10px] text-white/12">Paste a URL and hit Fetch</div>
              </div>
            ) : (
              <div className="px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-white/15">
                    <Clock size={9} />
                    Recent fetches
                  </div>
                  <button
                    onClick={clearHistory}
                    className="p-1 rounded text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-colors"
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
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-mono text-white/35 group-hover:text-white/55 truncate transition-colors">
                          {entry.url}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-white/15 mt-0.5">
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
