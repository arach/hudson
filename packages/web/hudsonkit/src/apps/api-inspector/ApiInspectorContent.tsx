'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  Send, Loader2, ChevronDown, X, Plus, Check,
  ToggleLeft, ToggleRight, AlertCircle,
} from 'lucide-react';
import { useApiInspector } from './ApiInspectorProvider';
import type { HttpMethod, KeyValuePair } from './types';
import {
  METHOD_COLORS, METHOD_BG_COLORS, getStatusColor,
  formatBytes, formatMs,
} from './types';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ---------------------------------------------------------------------------
// Key-Value Row
// ---------------------------------------------------------------------------

function KvRow({
  kv, onUpdate, onToggle, onRemove,
}: {
  kv: KeyValuePair;
  onUpdate: (id: string, field: 'key' | 'value', val: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 group">
      <button
        onClick={() => onToggle(kv.id)}
        className="shrink-0 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
      >
        {kv.enabled
          ? <ToggleRight size={14} className="text-accent/70" />
          : <ToggleLeft size={14} />
        }
      </button>
      <input
        value={kv.key}
        onChange={e => onUpdate(kv.id, 'key', e.target.value)}
        placeholder="Key"
        className={`flex-1 px-2 py-1.5 rounded bg-card/85 border border-border/70 text-[12px] font-mono outline-none focus:border-accent/50 transition-colors ${kv.enabled ? 'text-foreground/78' : 'text-muted-foreground'}`}
      />
      <input
        value={kv.value}
        onChange={e => onUpdate(kv.id, 'value', e.target.value)}
        placeholder="Value"
        className={`flex-1 px-2 py-1.5 rounded bg-card/85 border border-border/70 text-[12px] font-mono outline-none focus:border-accent/50 transition-colors ${kv.enabled ? 'text-foreground/78' : 'text-muted-foreground'}`}
      />
      <button
        onClick={() => onRemove(kv.id)}
        className="shrink-0 text-muted-foreground/40 hover:text-destructive/70 opacity-0 group-hover:opacity-100 transition-all"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

function TabBtn({ active, label, count, onClick }: {
  active: boolean; label: string; count?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-medium transition-colors relative ${
        active
          ? 'text-foreground/84'
          : 'text-muted-foreground hover:text-foreground/78'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1.5 text-[9px] text-accent/80 bg-accent/10 px-1.5 py-0.5 rounded-full">{count}</span>
      )}
      {active && <span className="absolute bottom-0 left-3 right-3 h-px bg-accent/50" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// JSON Syntax Highlighter (simple)
// ---------------------------------------------------------------------------

function highlightJson(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"\s*:/g, '<span class="text-info">"$1"</span>:')
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="text-warning">"$1"</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="text-info">$1</span>')
    .replace(/\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, '<span class="text-success">$1</span>');
}

function JsonBody({ body }: { body: string }) {
  let formatted = body;
  try {
    const parsed = JSON.parse(body);
    formatted = JSON.stringify(parsed, null, 2);
  } catch { /* use raw */ }

  return (
    <pre
      className="text-[12px] font-mono text-foreground/74 leading-relaxed whitespace-pre-wrap break-all"
      dangerouslySetInnerHTML={{ __html: highlightJson(formatted) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

export function ApiInspectorContent() {
  const ctx = useApiInspector();
  const {
    request, setMethod, setUrl, setBody, setBodyType,
    sendRequest, loading,
    response, responseError,
    requestTab, setRequestTab, responseTab, setResponseTab,
    methodOpen, setMethodOpen,
    // KV helpers
    addHeader, removeHeader, updateHeader, toggleHeader,
    addParam, removeParam, updateParam, toggleParam,
  } = ctx;

  const methodRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  // Close method dropdown on outside click
  useEffect(() => {
    if (!methodOpen) return;
    const handler = (e: MouseEvent) => {
      if (methodRef.current && !methodRef.current.contains(e.target as Node)) {
        setMethodOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [methodOpen, setMethodOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendRequest();
  }, [sendRequest]);

  // Keyboard shortcut: Cmd+Enter to send
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        sendRequest();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendRequest]);

  const activeHeaderCount = request.headers.filter(h => h.enabled && h.key.trim()).length;
  const activeParamCount = request.params.filter(p => p.enabled && p.key.trim()).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ---- URL Bar ---- */}
      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-3 border-b border-border/70">
        <div className="flex gap-2 items-stretch">
          {/* Method selector */}
          <div ref={methodRef} className="relative">
            <button
              type="button"
              onClick={() => setMethodOpen(!methodOpen)}
              className={`h-full px-3 rounded-lg border text-[12px] font-mono font-bold flex items-center gap-1.5 transition-colors ${METHOD_BG_COLORS[request.method]} ${METHOD_COLORS[request.method]}`}
            >
              {request.method}
              <ChevronDown size={11} className="text-muted-foreground/70" />
            </button>
            {methodOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border/70 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                {METHODS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMethod(m); setMethodOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-[12px] font-mono font-bold hover:bg-muted/50 transition-colors flex items-center justify-between ${METHOD_COLORS[m]}`}
                  >
                    {m}
                    {m === request.method && <Check size={11} className="text-muted-foreground" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* URL input */}
          <input
            ref={urlRef}
            type="text"
            value={request.url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="flex-1 px-3 py-2.5 rounded-lg bg-card/88 border border-border/70 text-[13px] text-foreground/84 placeholder:text-muted-foreground/60 outline-none focus:border-accent/50 transition-colors font-mono"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={loading || !request.url.trim()}
            className="px-5 py-2 rounded-lg bg-accent/10 text-accent text-[12px] font-semibold hover:bg-accent/20 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </form>

      {/* ---- Request Config Tabs ---- */}
      <div className="border-b border-border/70 flex items-center px-2">
        <TabBtn active={requestTab === 'params'} label="Params" count={activeParamCount} onClick={() => setRequestTab('params')} />
        <TabBtn active={requestTab === 'headers'} label="Headers" count={activeHeaderCount} onClick={() => setRequestTab('headers')} />
        <TabBtn active={requestTab === 'body'} label="Body" onClick={() => setRequestTab('body')} />
      </div>

      {/* ---- Request Config Panel ---- */}
      <div className="px-4 py-3 border-b border-border/70 max-h-[200px] overflow-y-auto">
        {requestTab === 'params' && (
          <div className="flex flex-col gap-1.5">
            {request.params.map(kv => (
              <KvRow key={kv.id} kv={kv} onUpdate={updateParam} onToggle={toggleParam} onRemove={removeParam} />
            ))}
            <button onClick={addParam} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground/74 transition-colors mt-1">
              <Plus size={11} /> Add parameter
            </button>
          </div>
        )}

        {requestTab === 'headers' && (
          <div className="flex flex-col gap-1.5">
            {request.headers.map(kv => (
              <KvRow key={kv.id} kv={kv} onUpdate={updateHeader} onToggle={toggleHeader} onRemove={removeHeader} />
            ))}
            <button onClick={addHeader} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground/74 transition-colors mt-1">
              <Plus size={11} /> Add header
            </button>
          </div>
        )}

        {requestTab === 'body' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {(['none', 'json', 'text'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setBodyType(t)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    request.bodyType === t
                      ? 'bg-accent/10 text-accent border border-accent/30'
                      : 'text-muted-foreground hover:text-foreground/78 border border-transparent'
                  }`}
                >
                  {t === 'none' ? 'None' : t.toUpperCase()}
                </button>
              ))}
            </div>
            {request.bodyType !== 'none' && (
              <textarea
                value={request.body}
                onChange={e => setBody(e.target.value)}
                placeholder={request.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body'}
                className="w-full h-[120px] px-3 py-2 rounded-lg bg-card/85 border border-border/70 text-[12px] text-foreground/78 font-mono outline-none focus:border-accent/50 transition-colors resize-none"
                spellCheck={false}
              />
            )}
          </div>
        )}
      </div>

      {/* ---- Response Section ---- */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Response header */}
        {(response || responseError) && (
          <div className="border-b border-border/70 flex items-center justify-between px-4">
            <div className="flex items-center">
              <TabBtn active={responseTab === 'body'} label="Response" onClick={() => setResponseTab('body')} />
              <TabBtn active={responseTab === 'headers'} label="Headers" count={response ? Object.keys(response.headers).length : undefined} onClick={() => setResponseTab('headers')} />
            </div>
            {response && (
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className={`font-bold ${getStatusColor(response.status)}`}>
                  {response.status} {response.statusText}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-muted-foreground">{formatMs(response.timing.durationMs)}</span>
                <span className="text-muted-foreground/60">|</span>
                <span className="text-muted-foreground">{formatBytes(response.size)}</span>
              </div>
            )}
          </div>
        )}

        {/* Response body */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-[13px]">Sending request</span>
              </div>
            </div>
          )}

          {responseError && !loading && (
            <div className="flex items-center gap-2 text-destructive/80 text-[13px] p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <AlertCircle size={15} />
              {responseError}
            </div>
          )}

          {response && !loading && responseTab === 'body' && (
            response.bodyType === 'json'
              ? <JsonBody body={response.body} />
              : (
                <pre className="text-[12px] font-mono text-foreground/74 leading-relaxed whitespace-pre-wrap break-all">
                  {response.body}
                </pre>
              )
          )}

          {response && !loading && responseTab === 'headers' && (
            <div className="flex flex-col gap-1">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="flex gap-3 py-1 border-b border-border/50 last:border-0">
                  <span className="text-[12px] font-mono text-info/80 shrink-0 min-w-[180px]">{key}</span>
                  <span className="text-[12px] font-mono text-foreground/72 break-all">{value}</span>
                </div>
              ))}
            </div>
          )}

          {!response && !responseError && !loading && (
            <div className="flex items-center justify-center h-full text-muted-foreground/70 text-[13px]">
              Enter a URL and click Send to make a request
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
