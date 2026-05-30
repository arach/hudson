'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { HObservability, HObservabilityDefault } from '../../observability/core';
import type {
  HLogLevel,
  HObservation,
  HObservationKind,
} from '../../types/observability';

type LevelFilter = HLogLevel | 'all';
type KindFilter = HObservationKind | 'all';
type InspectorTone = 'neutral' | 'cyan' | 'emerald' | 'amber' | 'red';

type InspectorRowData = {
  label: string;
  value: string;
  tone?: InspectorTone;
  mono?: boolean;
};

type InspectorSectionData = {
  title: string;
  rows: InspectorRowData[];
};

export interface HudLoggerUseEventsOptions {
  maxEvents?: number;
}

export interface HudLoggerSummary {
  total: number;
  errors: number;
  warnings: number;
  activeSpans: number;
  lastEvent: HObservation | null;
}

export interface HudLoggerProps {
  observability?: HObservability;
  events?: readonly HObservation[];
  maxEvents?: number;
  title?: string;
  className?: string;
  emptyMessage?: ReactNode;
  showHeader?: boolean;
  showInspector?: boolean;
  initialTail?: boolean;
}

export interface HudLoggerStatusItemProps {
  observability?: HObservability;
  maxEvents?: number;
  label?: string;
  className?: string;
  showCounts?: boolean;
}

const LEVELS: HLogLevel[] = ['debug', 'info', 'warn', 'error'];
const KINDS: HObservationKind[] = ['log', 'metric', 'span'];

export function useHudLoggerEvents(
  observability: HObservability = HObservabilityDefault,
  options: HudLoggerUseEventsOptions = {},
) {
  const maxEvents = options.maxEvents ?? 200;
  const [events, setEvents] = useState<HObservation[]>(() =>
    observability.snapshot().slice(-maxEvents).reverse(),
  );

  useEffect(() => {
    const sync = () => {
      setEvents(observability.snapshot().slice(-maxEvents).reverse());
    };
    const unsubscribe = observability.subscribe(sync);
    sync();
    return unsubscribe;
  }, [maxEvents, observability]);

  return events;
}

export function summarizeHudLoggerEvents(events: readonly HObservation[]): HudLoggerSummary {
  return {
    total: events.length,
    errors: events.filter((event) => event.kind === 'log' && event.level === 'error').length,
    warnings: events.filter((event) => event.kind === 'log' && event.level === 'warn').length,
    activeSpans: events.filter((event) => event.kind === 'span' && event.status === 'active').length,
    lastEvent: events[0] ?? null,
  };
}

export function useHudLoggerSummary(
  observability: HObservability = HObservabilityDefault,
  options: HudLoggerUseEventsOptions = {},
) {
  const events = useHudLoggerEvents(observability, options);
  return useMemo(() => summarizeHudLoggerEvents(events), [events]);
}

export function HudLoggerStatusItem({
  observability = HObservabilityDefault,
  maxEvents = 200,
  label = 'Logs',
  className = '',
  showCounts = false,
}: HudLoggerStatusItemProps) {
  const summary = useHudLoggerSummary(observability, { maxEvents });
  const tone = summary.errors > 0
    ? 'red'
    : summary.warnings > 0 || summary.activeSpans > 0
      ? 'amber'
      : 'emerald';

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 font-mono text-[9px] font-light uppercase tracking-[0.18em] ${statusItemToneClass(tone)} ${className}`}
      title={`${summary.total} events, ${summary.errors} errors, ${summary.activeSpans} active spans`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusItemDotClass(tone)}`} />
      <span>{label}</span>
      {showCounts && (
        <>
          <span className="tabular-nums">{summary.total}</span>
          <span className="tabular-nums">/{summary.errors}</span>
        </>
      )}
    </span>
  );
}

export function HudLogger({
  observability = HObservabilityDefault,
  events: controlledEvents,
  maxEvents = 200,
  title = 'HudLogger',
  className = '',
  emptyMessage = 'No events match the current filters.',
  showHeader = true,
  showInspector = true,
  initialTail = true,
}: HudLoggerProps) {
  const liveEvents = useHudLoggerEvents(observability, { maxEvents });
  const events = useMemo(
    () => controlledEvents ? controlledEvents.slice(0, maxEvents) : liveEvents,
    [controlledEvents, liveEvents, maxEvents],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [query, setQuery] = useState('');
  const [tail, setTail] = useState(initialTail);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (kindFilter !== 'all' && event.kind !== kindFilter) return false;
        if (levelFilter !== 'all' && (event.kind !== 'log' || event.level !== levelFilter)) return false;
        if (!query.trim()) return true;
        const haystack = `${eventLabel(event)} ${event.category ?? ''} ${JSON.stringify(event.data ?? {})}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      }),
    [events, kindFilter, levelFilter, query],
  );

  useEffect(() => {
    if (tail) setSelectedId(filteredEvents[0]?.id ?? null);
  }, [filteredEvents, tail]);

  const selectedEvent =
    filteredEvents.find((event) => event.id === selectedId) ??
    filteredEvents[0] ??
    null;
  const summary = useMemo(() => summarizeHudLoggerEvents(events), [events]);

  const copyText = useCallback(async (text: string, key: string) => {
    const copied = await writeClipboardText(text);
    if (!copied) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1200);
  }, []);

  const selectEvent = useCallback((event: HObservation) => {
    setTail(false);
    setSelectedId(event.id);
  }, []);

  return (
    <section className={`grid min-h-[520px] overflow-hidden rounded-md border border-border bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_330px] ${!showInspector ? 'lg:grid-cols-1' : ''} ${className}`}>
      <main className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
        {showHeader && (
          <div className="border-b border-border bg-card/80 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                ariaLabel="copy filtered table"
                copied={copiedKey === 'table'}
                disabled={filteredEvents.length === 0}
                label="copy all"
                onClick={() => void copyText(eventsToCopyTable(filteredEvents), 'table')}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] font-light uppercase tracking-[0.16em] text-muted-foreground">
                <span>{title}</span>
                <span className="text-accent">{filteredEvents.length} shown</span>
                <span>{summary.total} buffered</span>
                <span>{summary.errors} errors</span>
                {summary.activeSpans > 0 && <span className="text-warning">{summary.activeSpans} active</span>}
              </div>
            </div>
            <label className="mt-2 flex min-w-0 items-center gap-2 border border-border bg-muted/20 px-2 py-1.5 font-mono text-[12px] font-light text-accent">
              <span className="shrink-0 text-success">$</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="grep message, category, payload"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <details className="mt-2 text-left">
              <summary className="cursor-pointer font-mono text-[10px] font-light uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
                filters / controls
              </summary>
              <div className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-[1fr_1fr_auto]">
                <FilterGroup label="Kind">
                  <FilterButton active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>
                    all
                  </FilterButton>
                  {KINDS.map((kind) => (
                    <FilterButton key={kind} active={kindFilter === kind} onClick={() => setKindFilter(kind)}>
                      {kind}
                    </FilterButton>
                  ))}
                </FilterGroup>
                <FilterGroup label="Level">
                  <FilterButton active={levelFilter === 'all'} onClick={() => setLevelFilter('all')}>
                    all
                  </FilterButton>
                  {LEVELS.map((level) => (
                    <FilterButton key={level} active={levelFilter === level} onClick={() => setLevelFilter(level)}>
                      {level}
                    </FilterButton>
                  ))}
                </FilterGroup>
                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTail((value) => !value)}
                    className={`border px-2.5 py-1.5 font-mono text-[10px] font-light uppercase tracking-[0.14em] ${
                      tail
                        ? 'border-accent/30 bg-accent/10 text-accent'
                        : 'border-border bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    tail {tail ? 'on' : 'off'}
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        <div className="max-h-[650px] overflow-auto">
          <div className="min-w-[760px] font-mono text-[10px] font-light">
            <div className="sticky top-0 z-10 grid grid-cols-[62px_76px_58px_72px_112px_minmax(260px,1fr)_92px] border-b border-border bg-card px-3 py-1.5 font-light uppercase tracking-[0.14em] text-muted-foreground">
              <span className="sticky left-0 bg-card pr-2">Copy</span>
              <span>Time</span>
              <span>Kind</span>
              <span>Level</span>
              <span>Category</span>
              <span>Message</span>
              <span>Id</span>
            </div>
            {filteredEvents.map((event) => (
              <div
                key={`${event.id}-${eventTimestampLabel(event)}`}
                role="button"
                tabIndex={0}
                onClick={() => selectEvent(event)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                    keyboardEvent.preventDefault();
                    selectEvent(event);
                  }
                }}
                className={`grid w-full grid-cols-[62px_76px_58px_72px_112px_minmax(260px,1fr)_92px] items-center border-b px-3 py-1 text-left transition ${
                  selectedEvent?.id === event.id
                    ? 'border-accent/30 bg-accent/10'
                    : 'border-border hover:bg-muted/35'
                }`}
              >
                <button
                  type="button"
                  aria-label={`copy row ${shortEventId(event.id)}`}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    void copyText(eventToCopyRow(event).join('\t'), event.id);
                  }}
                  className={`sticky left-0 z-[1] justify-self-start border border-border px-1.5 py-0.5 font-mono text-[9px] font-light uppercase tracking-[0.12em] text-muted-foreground hover:border-accent/30 hover:text-accent ${
                    selectedEvent?.id === event.id ? 'bg-accent/10' : 'bg-background'
                  }`}
                >
                  {copiedKey === event.id ? 'copied' : 'copy'}
                </button>
                <span className="tabular-nums text-muted-foreground">{eventTimestampLabel(event)}</span>
                <span className="uppercase tracking-[0.13em] text-muted-foreground">{event.kind}</span>
                <span className={`uppercase tracking-[0.13em] ${eventSignalClass(event)}`}>{eventSignalLabel(event)}</span>
                <span className="truncate uppercase tracking-[0.13em] text-muted-foreground">{event.category ?? '-'}</span>
                <span className="truncate font-sans text-[12px] font-normal normal-case tracking-normal text-foreground">{eventLabel(event)}</span>
                <span className="truncate text-muted-foreground">{shortEventId(event.id)}</span>
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <div className="border-b border-border px-3 py-5 font-sans text-[13px] text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      </main>

      {showInspector && (
        <PayloadInspector
          copied={selectedEvent ? copiedKey === `inspector:${selectedEvent.id}` : false}
          event={selectedEvent}
          onCopyRow={(event) => void copyText(eventToCopyRow(event).join('\t'), `inspector:${event.id}`)}
        />
      )}
    </section>
  );
}

function PayloadInspector({
  copied,
  event,
  onCopyRow,
}: {
  copied: boolean;
  event: HObservation | null;
  onCopyRow: (event: HObservation) => void;
}) {
  return (
    <aside className="bg-background p-3 lg:p-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="font-mono text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">
          Payload inspector
        </div>
        {event ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCopyRow(event)}
              className="border border-border bg-muted/20 px-2 py-1 font-mono text-[9px] font-light uppercase tracking-[0.14em] text-muted-foreground transition hover:border-accent/30 hover:text-accent"
            >
              {copied ? 'copied' : 'copy row'}
            </button>
            <div className={`font-mono text-[10px] uppercase tracking-[0.14em] ${eventSignalClass(event)}`}>
              {eventSignalLabel(event)}
            </div>
          </div>
        ) : null}
      </div>
      {event ? (
        <div className="mt-3 grid gap-3">
          <div className="border border-accent/30 bg-accent/10">
            <div className="flex flex-wrap items-center gap-2 border-b border-accent/20 px-3 py-2">
              <EventPill event={event} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {event.kind}
              </span>
            </div>
            <div className="px-3 py-2">
              <div className="font-mono text-[10px] font-light uppercase tracking-[0.16em] text-accent">
                selected event
              </div>
              <div className="mt-1 break-words text-[14px] font-normal leading-5 text-foreground">
                {eventLabel(event)}
              </div>
            </div>
          </div>

          {inspectorSections(event).map((section) => (
            <InspectorSection key={section.title} section={section} />
          ))}

          <JsonBlock label="payload.data" value={event.data ?? {}} />
          {event.kind === 'metric' && event.tags ? (
            <JsonBlock label="metric.tags" value={event.tags} />
          ) : null}
          {event.kind === 'span' && event.error ? (
            <JsonBlock label="span.error" value={event.error} />
          ) : null}
        </div>
      ) : (
        <div className="mt-4 border border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
          No event selected.
        </div>
      )}
    </aside>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
        active
          ? 'border-accent/30 bg-accent/10 text-accent'
          : 'border-border bg-muted/20 text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function CopyButton({
  ariaLabel,
  copied,
  disabled = false,
  label,
  onClick,
}: {
  ariaLabel: string;
  copied: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="border border-border bg-muted/20 px-2 py-1 font-mono text-[10px] font-light uppercase tracking-[0.14em] text-muted-foreground transition hover:border-accent/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? 'copied' : label}
    </button>
  );
}

function EventPill({ event }: { event: HObservation }) {
  const label = eventSignalLabel(event);
  const tone = eventSignalTone(event);
  const toneClass =
    tone === 'red'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : tone === 'amber'
        ? 'border-warning/30 bg-warning/10 text-warning'
        : tone === 'emerald'
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-accent/30 bg-accent/10 text-accent';

  return (
    <span className={`rounded-full border px-1.5 py-px font-mono text-[8.5px] uppercase tracking-[0.13em] ${toneClass}`}>
      {label}
    </span>
  );
}

function InspectorSection({ section }: { section: InspectorSectionData }) {
  return (
    <section className="border border-border bg-muted/20">
      <div className="border-b border-border bg-muted/30 px-3 py-1.5 font-mono text-[9px] font-light uppercase tracking-[0.16em] text-muted-foreground">
        {section.title}
      </div>
      <div className="divide-y divide-border/80">
        {section.rows.map((row) => (
          <InspectorRow key={`${section.title}-${row.label}`} row={row} />
        ))}
      </div>
    </section>
  );
}

function InspectorRow({ row }: { row: InspectorRowData }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 px-3 py-1.5">
      <div className="font-mono text-[9.5px] font-light uppercase tracking-[0.14em] text-muted-foreground">
        {row.label}
      </div>
      <div className={`min-w-0 break-words text-[12px] leading-5 ${row.mono ? 'font-mono tabular-nums' : 'font-sans'} ${inspectorToneClass(row.tone)}`}>
        {row.value}
      </div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border border-border bg-muted/20">
      <div className="border-b border-border bg-muted/30 px-3 py-1.5 font-mono text-[9px] font-light uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] font-light leading-5 text-foreground/75">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function inspectorSections(event: HObservation): InspectorSectionData[] {
  const sections: InspectorSectionData[] = [
    {
      title: 'Identity',
      rows: [
        { label: 'id', value: event.id, mono: true },
        { label: 'kind', value: event.kind, tone: 'cyan', mono: true },
        { label: 'category', value: event.category ?? 'none', mono: true },
      ],
    },
    {
      title: 'Signal',
      rows: [
        { label: signalLabelName(event), value: eventSignalLabel(event), tone: eventSignalTone(event), mono: true },
        { label: 'timestamp', value: formatTimestamp(event.timestamp), mono: true },
      ],
    },
  ];

  if (event.kind === 'log') {
    sections.push({
      title: 'Log',
      rows: [
        { label: 'message', value: event.message },
        { label: 'level', value: event.level, tone: eventSignalTone(event), mono: true },
      ],
    });
  }

  if (event.kind === 'metric') {
    sections.push({
      title: 'Metric',
      rows: [
        { label: 'name', value: event.name },
        { label: 'type', value: event.metricType, tone: 'emerald', mono: true },
        { label: 'value', value: formatMetricValue(event), tone: 'emerald', mono: true },
        { label: 'unit', value: event.unit ?? 'none', mono: true },
      ],
    });
  }

  if (event.kind === 'span') {
    sections.push({
      title: 'Trace',
      rows: [
        { label: 'name', value: event.name },
        { label: 'trace id', value: event.traceId, mono: true },
        { label: 'parent id', value: event.parentId ?? 'none', mono: true },
        { label: 'status', value: event.status, tone: eventSignalTone(event), mono: true },
        { label: 'duration', value: event.durationMs === undefined ? 'active' : `${event.durationMs}ms`, mono: true },
        { label: 'started', value: formatTimestamp(event.startTime), mono: true },
        { label: 'ended', value: event.endTime === undefined ? 'pending' : formatTimestamp(event.endTime), mono: true },
      ],
    });
  }

  return sections;
}

function eventLabel(event: HObservation) {
  if (event.kind === 'log') return event.message;
  return event.name;
}

function eventSignalLabel(event: HObservation) {
  if (event.kind === 'log') return event.level;
  if (event.kind === 'metric') return event.metricType;
  return event.status;
}

function eventSignalClass(event: HObservation) {
  const label = eventSignalLabel(event);
  if (label === 'error') return 'text-destructive';
  if (label === 'warn' || label === 'active') return 'text-warning';
  if (event.kind === 'metric' || label === 'ok') return 'text-success';
  return 'text-accent';
}

function eventSignalTone(event: HObservation): InspectorTone {
  const label = eventSignalLabel(event);
  if (label === 'error') return 'red';
  if (label === 'warn' || label === 'active') return 'amber';
  if (event.kind === 'metric' || label === 'ok') return 'emerald';
  return 'cyan';
}

function inspectorToneClass(tone: InspectorTone = 'neutral') {
  if (tone === 'red') return 'text-destructive';
  if (tone === 'amber') return 'text-warning';
  if (tone === 'emerald') return 'text-success';
  if (tone === 'cyan') return 'text-accent';
  return 'text-foreground';
}

function signalLabelName(event: HObservation) {
  if (event.kind === 'log') return 'level';
  if (event.kind === 'metric') return 'type';
  return 'status';
}

function formatMetricValue(event: Extract<HObservation, { kind: 'metric' }>) {
  return `${event.value}${event.unit ? ` ${event.unit}` : ''}`;
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const base = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${base}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function shortEventId(id: string) {
  return id.length > 10 ? id.slice(-10) : id;
}

function eventTimestampLabel(event: HObservation) {
  return new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function eventToCopyRow(event: HObservation) {
  return [
    eventTimestampLabel(event),
    event.kind,
    eventSignalLabel(event),
    event.category ?? '',
    eventLabel(event),
    event.id,
    JSON.stringify(event.data ?? {}),
  ].map(copyCell);
}

function eventsToCopyTable(events: readonly HObservation[]) {
  return [
    ['time', 'kind', 'signal', 'category', 'message', 'id', 'payload'].join('\t'),
    ...events.map((event) => eventToCopyRow(event).join('\t')),
  ].join('\n');
}

function copyCell(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path, which also works on non-HTTPS local previews.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function statusItemToneClass(tone: InspectorTone) {
  if (tone === 'red') return 'text-destructive';
  if (tone === 'amber') return 'text-warning';
  return 'text-success';
}

function statusItemDotClass(tone: InspectorTone) {
  if (tone === 'red') return 'bg-destructive';
  if (tone === 'amber') return 'bg-warning';
  return 'bg-success';
}
