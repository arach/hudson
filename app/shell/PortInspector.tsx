'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Check, ChevronDown, ChevronRight, Inbox, Link2, Play, Send, Unlink, X } from 'lucide-react';
import type { AppInput, AppOutput, PipeDefinition } from 'hudsonkit';
import { useDataBus, usePortActivity, type PortActivityEntry, type PortCatalogEntry } from './DataBusContext';

interface PortInspectorProps {
  appId: string;
}

type SendCandidate = {
  output: AppOutput;
  targetAppId: string;
  targetAppName: string;
  input: AppInput;
};

type ReceiveCandidate = {
  input: AppInput;
  sourceAppId: string;
  sourceAppName: string;
  output: AppOutput;
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canConnect(output: AppOutput, input: AppInput): boolean {
  return output.dataType === input.dataType || output.dataType === 'json' || input.dataType === 'json';
}

function findApp(catalog: PortCatalogEntry[], appId: string): PortCatalogEntry | undefined {
  return catalog.find(entry => entry.appId === appId);
}

function outputName(catalog: PortCatalogEntry[], appId: string, portId: string): string {
  return findApp(catalog, appId)?.outputs.find(port => port.id === portId)?.name ?? portId;
}

function inputName(catalog: PortCatalogEntry[], appId: string, portId: string): string {
  return findApp(catalog, appId)?.inputs.find(port => port.id === portId)?.name ?? portId;
}

function appName(catalog: PortCatalogEntry[], appId: string): string {
  return findApp(catalog, appId)?.appName ?? appId;
}

function hasPipe(
  pipes: PipeDefinition[],
  sourceAppId: string,
  sourcePortId: string,
  sinkAppId: string,
  sinkPortId: string,
): boolean {
  return pipes.some(pipe =>
    pipe.source.appId === sourceAppId &&
    pipe.source.portId === sourcePortId &&
    pipe.sink.appId === sinkAppId &&
    pipe.sink.portId === sinkPortId,
  );
}

function PortBadge({ children, tone = 'neutral' }: { children: string; tone?: 'cyan' | 'emerald' | 'neutral' }) {
  const color =
    tone === 'cyan'
      ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
      : tone === 'emerald'
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        : 'border-border bg-muted/50 text-muted-foreground';

  return (
    <span className={`inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${color}`}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function PortDefinitionList({ title, ports, tone }: { title: string; ports: (AppInput | AppOutput)[]; tone: 'cyan' | 'emerald' }) {
  if (ports.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {ports.map(port => (
          <div key={port.id} className="min-w-0 rounded border border-border/70 bg-background/35 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[11px] font-medium text-foreground">{port.name}</div>
              <PortBadge tone={tone}>{port.dataType}</PortBadge>
            </div>
            {port.description && (
              <div className="mt-1 text-[10px] leading-snug text-muted-foreground">{port.description}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: PortActivityEntry }) {
  const isPush = entry.direction === 'push';
  return (
    <div className={`border-b border-border/45 px-4 py-2.5 last:border-0 ${entry.success ? '' : 'bg-destructive/5'}`}>
      <div className="flex min-w-0 items-center gap-2">
        {isPush ? (
          <Send size={11} className="shrink-0 text-cyan-400" />
        ) : (
          <Inbox size={11} className="shrink-0 text-emerald-400" />
        )}
        {entry.success ? (
          <Check size={10} className="shrink-0 text-emerald-400/70" />
        ) : (
          <X size={10} className="shrink-0 text-destructive/80" />
        )}
        <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/75">
          {entry.portId} to {entry.peerAppId}
        </span>
        <span className="shrink-0 text-[9px] font-mono text-muted-foreground">{formatTime(entry.timestamp)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-muted-foreground">
        <span>{entry.dataType}</span>
        <span>{formatSize(entry.dataSize)}</span>
      </div>
      <div className="mt-1 line-clamp-2 break-all text-[10px] leading-snug text-muted-foreground/75">
        {entry.dataPreview}
      </div>
    </div>
  );
}

const EXPAND_STORAGE_KEY = 'hudson.portInspectorExpanded';

function usePersistedExpanded(): [boolean, (v: boolean) => void] {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EXPAND_STORAGE_KEY);
      if (raw === '1') setExpanded(true);
    } catch { /* ignore — SSR / private mode */ }
  }, []);
  const update = useCallback((v: boolean) => {
    setExpanded(v);
    try { window.localStorage.setItem(EXPAND_STORAGE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);
  return [expanded, update];
}

export function PortInspector({ appId }: PortInspectorProps) {
  const { getPortCatalog, createPipe, deletePipe, pushPipe, pipes } = useDataBus();
  const activity = usePortActivity(appId);
  const [busyPipeId, setBusyPipeId] = useState<string | null>(null);
  const [busyConnectionKey, setBusyConnectionKey] = useState<string | null>(null);
  const [expanded, setExpanded] = usePersistedExpanded();

  const catalog = getPortCatalog();
  const current = findApp(catalog, appId);

  const relatedPipes = useMemo(
    () => pipes.filter(pipe => pipe.source.appId === appId || pipe.sink.appId === appId),
    [pipes, appId],
  );

  const sendCandidates = useMemo<SendCandidate[]>(() => {
    if (!current) return [];
    return current.outputs.flatMap(output =>
      catalog
        .filter(entry => entry.appId !== appId)
        .flatMap(entry =>
          entry.inputs
            .filter(input => canConnect(output, input))
            .filter(input => !hasPipe(pipes, appId, output.id, entry.appId, input.id))
            .map(input => ({
              output,
              targetAppId: entry.appId,
              targetAppName: entry.appName,
              input,
            })),
        ),
    );
  }, [appId, catalog, current, pipes]);

  const receiveCandidates = useMemo<ReceiveCandidate[]>(() => {
    if (!current) return [];
    return current.inputs.flatMap(input =>
      catalog
        .filter(entry => entry.appId !== appId)
        .flatMap(entry =>
          entry.outputs
            .filter(output => canConnect(output, input))
            .filter(output => !hasPipe(pipes, entry.appId, output.id, appId, input.id))
            .map(output => ({
              input,
              sourceAppId: entry.appId,
              sourceAppName: entry.appName,
              output,
            })),
        ),
    );
  }, [appId, catalog, current, pipes]);

  const handleCreatePipe = useCallback(async (
    sourceAppId: string,
    sourcePortId: string,
    sinkAppId: string,
    sinkPortId: string,
  ) => {
    const key = `${sourceAppId}:${sourcePortId}:${sinkAppId}:${sinkPortId}`;
    setBusyConnectionKey(key);
    try {
      await createPipe({
        name: `${sourceAppId}:${sourcePortId} -> ${sinkAppId}:${sinkPortId}`,
        source: { appId: sourceAppId, portId: sourcePortId },
        sink: { appId: sinkAppId, portId: sinkPortId },
        enabled: true,
      });
    } finally {
      setBusyConnectionKey(null);
    }
  }, [createPipe]);

  const handlePushPipe = useCallback(async (pipeId: string) => {
    setBusyPipeId(pipeId);
    try {
      await pushPipe(pipeId);
    } finally {
      setBusyPipeId(null);
    }
  }, [pushPipe]);

  if (!current) return null;

  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
        title={expanded ? 'Collapse ports panel' : 'Expand ports panel'}
      >
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-foreground">
          <Activity size={12} className="text-cyan-400" />
          Ports
        </div>
        <div className="flex items-center gap-2">
          <PortBadge tone={relatedPipes.length > 0 ? 'cyan' : 'neutral'}>
            {relatedPipes.length === 1 ? '1 link' : `${relatedPipes.length} links`}
          </PortBadge>
          {expanded
            ? <ChevronDown size={12} className="text-muted-foreground" />
            : <ChevronRight size={12} className="text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
      <>
      <section className="border-t border-b border-border/60 px-4 py-3">
        <div className="space-y-3">
          <PortDefinitionList title="Outputs" ports={current.outputs} tone="cyan" />
          <PortDefinitionList title="Inputs" ports={current.inputs} tone="emerald" />
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Active Links
        </div>
        {relatedPipes.length === 0 ? (
          <div className="px-4 pb-3 text-[10px] leading-snug text-muted-foreground">
            No links are connected yet.
          </div>
        ) : (
          <div>
            {relatedPipes.map(pipe => {
              const source = appName(catalog, pipe.source.appId);
              const sink = appName(catalog, pipe.sink.appId);
              return (
                <div key={pipe.id} className="border-t border-border/45 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link2 size={11} className="shrink-0 text-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-mono text-foreground/80">
                        {source} <span className="text-muted-foreground">to</span> {sink}
                      </div>
                      <div className="mt-0.5 truncate text-[9px] font-mono text-muted-foreground">
                        {outputName(catalog, pipe.source.appId, pipe.source.portId)} to {inputName(catalog, pipe.sink.appId, pipe.sink.portId)}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePushPipe(pipe.id)}
                      disabled={busyPipeId !== null}
                      className="rounded border border-border bg-muted/40 p-1 text-muted-foreground transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40"
                      title="Push data now"
                    >
                      <Play size={11} />
                    </button>
                    <button
                      onClick={() => deletePipe(pipe.id)}
                      className="rounded border border-border bg-muted/40 p-1 text-muted-foreground transition-colors hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
                      title="Disconnect"
                    >
                      <Unlink size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(sendCandidates.length > 0 || receiveCandidates.length > 0) && (
        <section className="border-b border-border/60 px-4 py-3">
          {sendCandidates.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <Send size={10} />
                Send To
              </div>
              {sendCandidates.map(candidate => {
                const key = `${appId}:${candidate.output.id}:${candidate.targetAppId}:${candidate.input.id}`;
                return (
                  <button
                    key={key}
                    onClick={() => handleCreatePipe(appId, candidate.output.id, candidate.targetAppId, candidate.input.id)}
                    disabled={busyConnectionKey !== null}
                    className="flex w-full min-w-0 items-center gap-2 rounded border border-border/70 bg-background/35 px-2.5 py-2 text-left transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/10 disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/75">
                      {candidate.output.name}
                    </span>
                    <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/75">
                      {candidate.targetAppName} / {candidate.input.name}
                    </span>
                    <Link2 size={11} className="shrink-0 text-cyan-400" />
                  </button>
                );
              })}
            </div>
          )}

          {receiveCandidates.length > 0 && (
            <div className={sendCandidates.length > 0 ? 'mt-4 space-y-1.5' : 'space-y-1.5'}>
              <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <Inbox size={10} />
                Receive From
              </div>
              {receiveCandidates.map(candidate => {
                const key = `${candidate.sourceAppId}:${candidate.output.id}:${appId}:${candidate.input.id}`;
                return (
                  <button
                    key={key}
                    onClick={() => handleCreatePipe(candidate.sourceAppId, candidate.output.id, appId, candidate.input.id)}
                    disabled={busyConnectionKey !== null}
                    className="flex w-full min-w-0 items-center gap-2 rounded border border-border/70 bg-background/35 px-2.5 py-2 text-left transition-colors hover:border-emerald-500/35 hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/75">
                      {candidate.sourceAppName} / {candidate.output.name}
                    </span>
                    <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/75">
                      {candidate.input.name}
                    </span>
                    <Link2 size={11} className="shrink-0 text-emerald-400" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Activity
        </div>
        {activity.length === 0 ? (
          <div className="px-4 pb-4 text-[10px] leading-snug text-muted-foreground">
            No data has moved through this app yet.
          </div>
        ) : (
          <div>
            {activity.slice(0, 8).map(entry => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}
