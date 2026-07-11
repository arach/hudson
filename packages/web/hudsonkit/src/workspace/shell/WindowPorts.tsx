'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Link2, Play, Unlink, X } from '../../icons';
import type { AppInput, AppOutput } from '../../index';
import { useDataBus, type PortCatalogEntry } from '../context/DataBusContext';

interface WindowPortsProps {
  appId: string;
  inputs?: AppInput[];
  outputs?: AppOutput[];
}

const DOT_SIZE = 10;
const DOT_SIZE_CONNECTED = 13;
const DOT_OFFSET = -(DOT_SIZE / 2);
const DOT_OFFSET_CONNECTED = -(DOT_SIZE_CONNECTED / 2);
// Dot vertical position uses the full window height (matching PipeConnectorLayer
// which anchors arrows at bounds.y + bounds.h / 2). We do NOT offset for the
// title bar — that keeps single-port dots aligned with arrow termination.

function canConnect(out: AppOutput, inp: AppInput): boolean {
  return out.dataType === inp.dataType || out.dataType === 'json' || inp.dataType === 'json';
}

export function WindowPorts({ appId, inputs, outputs }: WindowPortsProps) {
  const { pipes } = useDataBus();
  const inputList = inputs ?? [];
  const outputList = outputs ?? [];

  const connectedPortIds = useMemo(() => {
    const set = new Set<string>();
    for (const pipe of pipes) {
      if (pipe.source.appId === appId) set.add(pipe.source.portId);
      if (pipe.sink.appId === appId) set.add(pipe.sink.portId);
    }
    return set;
  }, [pipes, appId]);

  if (inputList.length === 0 && outputList.length === 0) return null;

  return (
    <>
      {inputList.map((port, idx) => (
        <PortDot
          key={`in-${port.id}`}
          appId={appId}
          port={port}
          kind="input"
          side="left"
          index={idx}
          total={inputList.length}
          tone="emerald"
          connected={connectedPortIds.has(port.id)}
        />
      ))}
      {outputList.map((port, idx) => (
        <PortDot
          key={`out-${port.id}`}
          appId={appId}
          port={port}
          kind="output"
          side="right"
          index={idx}
          total={outputList.length}
          tone="cyan"
          connected={connectedPortIds.has(port.id)}
        />
      ))}
    </>
  );
}

interface PortDotProps {
  appId: string;
  port: AppInput | AppOutput;
  kind: 'input' | 'output';
  side: 'left' | 'right';
  index: number;
  total: number;
  tone: 'cyan' | 'emerald';
  connected: boolean;
}

function PortDot({ appId, port, kind, side, index, total, tone, connected }: PortDotProps) {
  const [hover, setHover] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const size = connected ? DOT_SIZE_CONNECTED : DOT_SIZE;
  const offset = connected ? DOT_OFFSET_CONNECTED : DOT_OFFSET;
  const fraction = total === 1 ? 0.5 : (index + 0.5) / total;
  const baseOpacity = connected || popoverOpen ? 1 : 0;
  const isActive = popoverOpen;

  // Close popover on outside click / Esc
  useEffect(() => {
    if (!popoverOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) setPopoverOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPopoverOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [popoverOpen]);

  return (
    <div
      ref={containerRef}
      data-window-port
      data-port-connected={connected ? 'true' : 'false'}
      data-port-active={isActive ? 'true' : 'false'}
      style={{
        position: 'absolute',
        top: `${fraction * 100}%`,
        transform: 'translateY(-50%)',
        ...(side === 'left' ? { left: offset } : { right: offset }),
        width: size,
        height: size,
        opacity: baseOpacity,
        transition: 'opacity 150ms ease, transform 150ms ease',
        pointerEvents: 'auto',
        zIndex: popoverOpen ? 60 : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onMouseDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          setPopoverOpen(prev => !prev);
        }}
        className={`block rounded-full border ${
          tone === 'cyan'
            ? 'bg-cyan-500/85 border-cyan-300/70 hover:bg-cyan-400'
            : 'bg-emerald-500/85 border-emerald-300/70 hover:bg-emerald-400'
        }`}
        style={{
          width: '100%',
          height: '100%',
          padding: 0,
          cursor: 'pointer',
          boxShadow: popoverOpen
            ? `0 0 0 3px ${tone === 'cyan' ? 'rgba(6,182,212,0.45)' : 'rgba(16,185,129,0.45)'}, 0 0 0 5px rgba(0,0,0,0.4)`
            : connected
              ? '0 0 0 2px rgba(0, 0, 0, 0.45), 0 0 8px rgba(34, 211, 238, 0.35)'
              : '0 0 0 2px rgba(0, 0, 0, 0.35)',
          transform: popoverOpen ? 'scale(1.35)' : hover ? 'scale(1.25)' : 'scale(1)',
          transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
        aria-label={`${kind} port ${port.name}`}
        aria-expanded={popoverOpen}
      />
      {hover && !popoverOpen && (
        <div
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border bg-popover/95 px-2 py-1 text-[10px] font-mono leading-tight text-foreground shadow-lg backdrop-blur ${
            tone === 'cyan' ? 'border-cyan-500/40' : 'border-emerald-500/40'
          }`}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            ...(side === 'left'
              ? { left: 'calc(100% + 10px)' }
              : { right: 'calc(100% + 10px)' }),
          }}
        >
          <div className="font-semibold text-foreground">{port.name}</div>
          <div className="text-muted-foreground">
            <span className={tone === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}>
              {kind}
            </span>{' '}
            · {port.dataType}
            {connected && <span className="ml-1 text-foreground/60">· linked</span>}
          </div>
        </div>
      )}
      {popoverOpen && (
        <PortPopover
          appId={appId}
          port={port}
          kind={kind}
          tone={tone}
          side={side}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
}

interface PortPopoverProps {
  appId: string;
  port: AppInput | AppOutput;
  kind: 'input' | 'output';
  tone: 'cyan' | 'emerald';
  side: 'left' | 'right';
  onClose: () => void;
}

function PortPopover({ appId, port, kind, tone, side, onClose }: PortPopoverProps) {
  const { getPortCatalog, pipes, createPipe, deletePipe, pushPipe } = useDataBus();
  const [busy, setBusy] = useState(false);

  const catalog = getPortCatalog();
  const relatedPipes = useMemo(
    () => pipes.filter(p =>
      (p.source.appId === appId && p.source.portId === port.id) ||
      (p.sink.appId === appId && p.sink.portId === port.id)
    ),
    [pipes, appId, port.id],
  );

  const candidates = useMemo(() => {
    if (kind === 'output') {
      const out = port as AppOutput;
      const list: { label: string; targetAppId: string; targetPortId: string }[] = [];
      for (const entry of catalog) {
        if (entry.appId === appId) continue;
        for (const inp of entry.inputs) {
          if (!canConnect(out, inp)) continue;
          if (pipes.some(p => p.source.appId === appId && p.source.portId === out.id && p.sink.appId === entry.appId && p.sink.portId === inp.id)) continue;
          list.push({ label: `${entry.appName} / ${inp.name}`, targetAppId: entry.appId, targetPortId: inp.id });
        }
      }
      return list;
    }
    const inp = port as AppInput;
    const list: { label: string; targetAppId: string; targetPortId: string }[] = [];
    for (const entry of catalog) {
      if (entry.appId === appId) continue;
      for (const out of entry.outputs) {
        if (!canConnect(out, inp)) continue;
        if (pipes.some(p => p.sink.appId === appId && p.sink.portId === inp.id && p.source.appId === entry.appId && p.source.portId === out.id)) continue;
        list.push({ label: `${entry.appName} / ${out.name}`, targetAppId: entry.appId, targetPortId: out.id });
      }
    }
    return list;
  }, [catalog, kind, port, pipes, appId]);

  const handleConnect = useCallback(async (targetAppId: string, targetPortId: string) => {
    setBusy(true);
    try {
      if (kind === 'output') {
        await createPipe({
          name: `${appId}:${port.id} -> ${targetAppId}:${targetPortId}`,
          source: { appId, portId: port.id },
          sink: { appId: targetAppId, portId: targetPortId },
          enabled: true,
        });
      } else {
        await createPipe({
          name: `${targetAppId}:${targetPortId} -> ${appId}:${port.id}`,
          source: { appId: targetAppId, portId: targetPortId },
          sink: { appId, portId: port.id },
          enabled: true,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [appId, port.id, kind, createPipe]);

  const handlePush = useCallback(async (pipeId: string) => {
    setBusy(true);
    try { await pushPipe(pipeId); } finally { setBusy(false); }
  }, [pushPipe]);

  const handleDisconnect = useCallback(async (pipeId: string) => {
    setBusy(true);
    try { await deletePipe(pipeId); } finally { setBusy(false); }
  }, [deletePipe]);

  return (
    <div
      role="dialog"
      className={`absolute z-[60] flex flex-col gap-2 rounded-lg border bg-popover/95 px-3 py-2.5 shadow-xl backdrop-blur ${
        tone === 'cyan' ? 'border-cyan-500/40' : 'border-emerald-500/40'
      }`}
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
        ...(side === 'left'
          ? { left: 'calc(100% + 14px)' }
          : { right: 'calc(100% + 14px)' }),
        minWidth: 240,
        maxWidth: 320,
        pointerEvents: 'auto',
      }}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-foreground">{port.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground">
            <span className={tone === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}>{kind}</span>
            {' · '}{port.dataType}
            {relatedPipes.length > 0 && <span> · {relatedPipes.length} linked</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {port.description && (
        <p className="text-[10.5px] leading-snug text-muted-foreground">{port.description}</p>
      )}

      {relatedPipes.length > 0 && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Linked</div>
          {relatedPipes.map(pipe => {
            const otherAppId = pipe.source.appId === appId ? pipe.sink.appId : pipe.source.appId;
            const otherEntry = catalog.find(e => e.appId === otherAppId);
            const otherPortId = pipe.source.appId === appId ? pipe.sink.portId : pipe.source.portId;
            const otherSide = pipe.source.appId === appId ? 'sink' : 'source';
            const otherPort = otherSide === 'sink'
              ? otherEntry?.inputs.find(p => p.id === otherPortId)
              : otherEntry?.outputs.find(p => p.id === otherPortId);
            return (
              <div key={pipe.id} className="flex items-center gap-1.5">
                <Link2 size={11} className={`shrink-0 ${tone === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}`} />
                <span className="min-w-0 flex-1 truncate text-[10.5px] font-mono text-foreground/80">
                  {otherEntry?.appName ?? otherAppId} / {otherPort?.name ?? otherPortId}
                </span>
                {kind === 'output' && (
                  <button
                    type="button"
                    onClick={() => handlePush(pipe.id)}
                    disabled={busy}
                    className="rounded border border-border bg-muted/30 p-1 text-muted-foreground transition-colors hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40"
                    title="Push data now"
                  >
                    <Play size={10} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDisconnect(pipe.id)}
                  disabled={busy}
                  className="rounded border border-border bg-muted/30 p-1 text-muted-foreground transition-colors hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  title="Disconnect"
                >
                  <Unlink size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1 border-t border-border/60 pt-2">
        <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          {kind === 'output' ? 'Send to' : 'Receive from'}
        </div>
        {candidates.length === 0 ? (
          <div className="text-[10.5px] text-muted-foreground/70 leading-snug">
            No compatible {kind === 'output' ? 'inputs' : 'outputs'} available in this workspace.
          </div>
        ) : (
          candidates.map(c => (
            <button
              key={`${c.targetAppId}:${c.targetPortId}`}
              type="button"
              onClick={() => handleConnect(c.targetAppId, c.targetPortId)}
              disabled={busy}
              className={`flex w-full items-center gap-1.5 rounded border border-border/70 bg-background/30 px-2 py-1.5 text-left text-[10.5px] font-mono text-foreground/80 transition-colors disabled:opacity-40 ${
                tone === 'cyan'
                  ? 'hover:border-cyan-500/35 hover:bg-cyan-500/10'
                  : 'hover:border-emerald-500/35 hover:bg-emerald-500/10'
              }`}
            >
              <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <Link2 size={11} className={`shrink-0 ${tone === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}`} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
