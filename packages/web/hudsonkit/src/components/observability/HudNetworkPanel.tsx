'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, Pause, Play, Search, Trash2 } from 'lucide-react';
import {
  formatHudsonNetworkEntryAsCurl,
  formatHudsonNetworkEntryForAgent,
  HudsonNetworkCaptureDefault,
  HudsonNetworkStore,
  type HudsonCapturedBody,
  type HudsonNetworkEntry,
} from '../../observability/network';

type DetailTab = 'headers' | 'params' | 'request' | 'response' | 'timing';

export interface HudNetworkPanelProps {
  store?: HudsonNetworkStore;
  entries?: readonly HudsonNetworkEntry[];
  maxEntries?: number;
  className?: string;
  emptyMessage?: ReactNode;
  recording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
}

export function useHudsonNetworkEntries(
  store: HudsonNetworkStore = HudsonNetworkCaptureDefault,
  maxEntries = 100,
) {
  const [entries, setEntries] = useState<readonly HudsonNetworkEntry[]>(() =>
    store.snapshot().slice(0, maxEntries),
  );

  useEffect(() => {
    const sync = () => setEntries(store.snapshot().slice(0, maxEntries));
    const unsubscribe = store.subscribe(sync);
    sync();
    return unsubscribe;
  }, [maxEntries, store]);

  return entries;
}

function statusTone(entry: HudsonNetworkEntry) {
  if (entry.status === 'pending') return 'text-warning';
  if (entry.status === 'error') return 'text-destructive';
  if (entry.response?.status === 0) return 'text-muted-foreground/60';
  return 'text-success';
}

function methodTone(method: string) {
  if (method === 'GET') return 'text-success';
  if (method === 'POST') return 'text-warning';
  if (method === 'DELETE') return 'text-destructive';
  return 'text-accent';
}

function displayUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function displayHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function displayStatus(entry: HudsonNetworkEntry) {
  if (entry.response?.status === 0 && !entry.error) return '—';
  return entry.response?.status ?? (entry.status === 'pending' ? '…' : 'ERR');
}

function statusTitle(entry: HudsonNetworkEntry) {
  if (entry.response?.status === 0 && !entry.error) return 'Status unavailable to JavaScript';
  return undefined;
}

function HeaderRows({ headers }: { headers: Record<string, string> }) {
  const rows = Object.entries(headers);
  if (rows.length === 0) return <EmptyDetail>No headers</EmptyDetail>;
  return (
    <dl className="grid grid-cols-[minmax(120px,0.34fr)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[11px]">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="truncate font-mono text-accent/80" title={key}>{key}</dt>
          <dd className="break-all font-mono text-foreground/80" title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BodyView({ body }: { body?: HudsonCapturedBody }) {
  if (!body) return <EmptyDetail>No body</EmptyDetail>;
  if (body.unavailable) return <EmptyDetail>Body not captured ({body.unavailable})</EmptyDetail>;
  let text = body.text;
  let isJson = false;
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
    isJson = true;
  } catch {
    // Keep non-JSON bodies verbatim.
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-card/35 shadow-inner">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border/60 bg-muted/20 px-3">
        <span className="size-1.5 rounded-full bg-destructive/75" />
        <span className="size-1.5 rounded-full bg-warning/75" />
        <span className="size-1.5 rounded-full bg-success/75" />
        <span className={`ml-auto font-mono text-[8px] uppercase tracking-[0.18em] ${isJson ? 'text-info/80' : 'text-muted-foreground/60'}`}>
          {isJson ? 'JSON' : 'TEXT'}
        </span>
      </div>
      <pre className={`min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed ${isJson ? 'whitespace-pre text-foreground/65' : 'whitespace-pre-wrap break-words text-foreground/80'}`}>
        {text ? (isJson ? <JsonBody text={text} /> : text) : '(empty body)'}
      </pre>
      {body.truncated ? (
        <span className="absolute bottom-2 right-3 inline-flex rounded border border-warning/25 bg-background/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning shadow-sm">
          truncated at {formatBytes(body.capturedSize)}
        </span>
      ) : null}
    </div>
  );
}

const JSON_TOKEN_PATTERN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g;

function JsonBody({ text }: { text: string }) {
  const tokens: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(JSON_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push(text.slice(cursor, index));

    if (match[1]) {
      const isKey = Boolean(match[2]);
      tokens.push(
        <span key={`${index}-value`} className={isKey ? 'text-accent' : 'text-success'}>
          {match[1]}
        </span>,
      );
      if (match[2]) tokens.push(<span key={`${index}-colon`} className="text-foreground/45">{match[2]}</span>);
    } else if (match[3]) {
      tokens.push(<span key={`${index}-boolean`} className="text-info">{match[3]}</span>);
    } else if (match[4]) {
      tokens.push(<span key={`${index}-null`} className="italic text-muted-foreground">{match[4]}</span>);
    } else if (match[5]) {
      tokens.push(<span key={`${index}-number`} className="text-warning">{match[5]}</span>);
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) tokens.push(text.slice(cursor));
  return <>{tokens}</>;
}

function EmptyDetail({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-[11px] text-muted-foreground">{children}</div>;
}

function DetailButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border-b px-2.5 py-2 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
        active
          ? 'border-accent text-accent'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

async function writeClipboard(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

export function HudNetworkPanel({
  store = HudsonNetworkCaptureDefault,
  entries: controlledEntries,
  maxEntries = 100,
  className = '',
  emptyMessage = 'Make a request to start capturing network activity.',
  recording = false,
  onRecordingChange,
}: HudNetworkPanelProps) {
  const liveEntries = useHudsonNetworkEntries(store, maxEntries);
  const entries = controlledEntries ?? liveEntries;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DetailTab>('headers');
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => [
      entry.request.method,
      entry.request.url,
      String(entry.response?.status ?? ''),
      entry.error?.message ?? '',
    ].join(' ').toLowerCase().includes(needle));
  }, [entries, query]);

  const selected = filtered.find((entry) => entry.id === selectedId) ?? filtered[0] ?? null;

  const copy = useCallback(async (key: string, text: string) => {
    if (!await writeClipboard(text)) return;
    setCopied(key);
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1200);
  }, []);

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground md:flex-row ${className}`}>
      <div className="flex min-h-0 basis-[42%] flex-col border-b border-border/70 md:min-w-[300px] md:border-b-0 md:border-r">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-card/40 px-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 transition-colors focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20">
            <Search size={12} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter requests"
              aria-label="Filter network requests"
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </label>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{filtered.length}</span>
          {onRecordingChange ? (
            <button
              type="button"
              onClick={() => onRecordingChange(!recording)}
              aria-pressed={recording}
              className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 font-mono text-[9px] font-medium uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                recording
                  ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15'
                  : 'border-success/25 bg-success/10 text-success hover:bg-success/15'
              }`}
              title={recording ? 'Stop capturing requests' : 'Start capturing requests'}
            >
              {recording ? <Pause size={10} /> : <Play size={10} />}
              {recording ? 'Stop' : 'Start'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => store.clear()}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Clear captured requests"
            aria-label="Clear captured requests"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="grid grid-cols-[54px_minmax(0,1fr)_54px_62px] gap-2 border-b border-border/60 bg-card/20 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
          <span>Method</span><span>Request</span><span>Status</span><span className="text-right">Time</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              {onRecordingChange && !recording
                ? 'Capture is stopped. Start recording to inspect new requests.'
                : emptyMessage}
            </div>
          ) : filtered.map((entry) => {
            const active = selected?.id === entry.id;
            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                aria-pressed={active}
                className={`grid w-full grid-cols-[54px_minmax(0,1fr)_54px_62px] gap-2 border-b border-border/45 border-l-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  active ? 'border-l-accent bg-accent/[0.08]' : 'border-l-transparent hover:bg-muted/30'
                }`}
              >
                <span className={`font-mono text-[10px] font-semibold ${methodTone(entry.request.method)}`}>
                  {entry.request.method}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px] text-foreground/85" title={entry.request.url}>
                    {displayUrl(entry.request.url)}
                  </span>
                  <span className="block truncate text-[9px] text-muted-foreground/65">{displayHost(entry.request.url)}</span>
                </span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${statusTone(entry)}`}
                  title={statusTitle(entry)}
                >
                  {displayStatus(entry)}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {entry.timing.durationMs === undefined ? '—' : `${entry.timing.durationMs.toFixed(0)} ms`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border/70 bg-card/40 px-3 py-1.5">
              <span className={`font-mono text-[10px] font-semibold ${methodTone(selected.request.method)}`}>
                {selected.request.method}
              </span>
              <span className="min-w-[120px] flex-1 truncate font-mono text-[11px] text-foreground/85" title={selected.request.url}>
                {selected.request.url}
              </span>
              <CopyAction
                copied={copied === 'agent'}
                label="Copy for agent"
                onClick={() => copy('agent', formatHudsonNetworkEntryForAgent(selected))}
              />
              <CopyAction
                copied={copied === 'curl'}
                label="Copy cURL"
                onClick={() => copy('curl', formatHudsonNetworkEntryAsCurl(selected))}
              />
              <CopyAction
                copied={copied === 'response'}
                label="Copy response"
                onClick={() => copy('response', selected.response?.body?.text ?? '')}
                disabled={!selected.response?.body?.text}
              />
            </div>
            <div className="flex shrink-0 items-center overflow-x-auto border-b border-border/70 bg-card/20 px-2">
              {(['headers', 'params', 'request', 'response', 'timing'] as DetailTab[]).map((value) => (
                <DetailButton key={value} active={tab === value} onClick={() => setTab(value)}>
                  {value}
                </DetailButton>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <NetworkDetail entry={selected} tab={tab} />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">No request selected</div>
        )}
      </div>
    </section>
  );
}

function CopyAction({
  copied,
  label,
  onClick,
  disabled = false,
}: {
  copied: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/20 px-2 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function NetworkDetail({ entry, tab }: { entry: HudsonNetworkEntry; tab: DetailTab }) {
  if (tab === 'headers') {
    return (
      <div className="space-y-5">
        <DetailSection title="Request headers"><HeaderRows headers={entry.request.headers} /></DetailSection>
        <DetailSection title="Response headers"><HeaderRows headers={entry.response?.headers ?? {}} /></DetailSection>
      </div>
    );
  }

  if (tab === 'params') {
    let params: Record<string, string> = {};
    try {
      params = Object.fromEntries(new URL(entry.request.url).searchParams.entries());
    } catch {
      // Invalid URLs simply have no parsed params.
    }
    return <DetailSection title="Query parameters"><HeaderRows headers={params} /></DetailSection>;
  }

  if (tab === 'request') {
    return <DetailSection title="Request body" fill><BodyView body={entry.request.body} /></DetailSection>;
  }

  if (tab === 'response') {
    return <DetailSection title="Response body" fill><BodyView body={entry.response?.body} /></DetailSection>;
  }

  return (
    <DetailSection title="Timing">
      <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 font-mono text-[11px]">
        <dt className="text-muted-foreground">Started</dt>
        <dd className="text-foreground/80">{entry.timing.startedAt.toFixed(1)} ms</dd>
        <dt className="text-muted-foreground">Completed</dt>
        <dd className="text-foreground/80">{entry.timing.completedAt?.toFixed(1) ?? 'pending'} ms</dd>
        <dt className="text-muted-foreground">Total</dt>
        <dd className="text-accent">{entry.timing.durationMs?.toFixed(1) ?? 'pending'} ms</dd>
        <dt className="text-muted-foreground">Response size</dt>
        <dd className="text-foreground/80">{formatBytes(entry.response?.body?.originalSize ?? entry.response?.size)}</dd>
        <dt className="text-muted-foreground">Request ID</dt>
        <dd className="break-all text-foreground/80">{entry.requestId}</dd>
        <dt className="text-muted-foreground">Trace ID</dt>
        <dd className="break-all text-foreground/80">{entry.traceId}</dd>
      </dl>
      {entry.error ? <div className="mt-4 rounded border border-destructive/25 bg-destructive/10 p-3 text-[11px] text-destructive">{entry.error.message}</div> : null}
    </DetailSection>
  );
}

function DetailSection({
  title,
  children,
  fill = false,
}: {
  title: string;
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <section className={fill ? 'flex h-full min-h-0 flex-col' : undefined}>
      <h3 className="mb-2 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
