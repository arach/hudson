'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowRight, ArrowLeft, Check, X, Activity, GripHorizontal, Link, Unlink, Play } from 'lucide-react';
import { usePortActivity, useDataBus, type PortActivityEntry } from './DataBusContext';
import type { PipeDefinition } from 'hudsonkit';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EntryRow({ entry }: { entry: PortActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isPush = entry.direction === 'push';

  return (
    <div className={`border-b border-white/[0.03] last:border-0 ${entry.success ? '' : 'bg-red-500/5'}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {isPush ? (
          <ArrowRight size={10} className="text-cyan-500 shrink-0" />
        ) : (
          <ArrowLeft size={10} className="text-emerald-400/60 shrink-0" />
        )}
        {entry.success ? (
          <Check size={9} className="text-emerald-500/50 shrink-0" />
        ) : (
          <X size={9} className="text-red-400/50 shrink-0" />
        )}
        <span className="text-[10px] font-mono text-zinc-500 truncate flex-1">
          <span className="text-zinc-700">{entry.portId}</span>
          <span className="text-zinc-800 mx-1">{isPush ? '→' : '←'}</span>
          <span className="text-zinc-700">{entry.peerAppId}</span>
        </span>
        <span className="text-[9px] font-mono text-zinc-800 shrink-0">{entry.dataType}</span>
        <span className="text-[9px] font-mono text-zinc-800 shrink-0">{formatSize(entry.dataSize)}</span>
        <span className="text-[9px] font-mono text-zinc-800 shrink-0">{formatTime(entry.timestamp)}</span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2">
          <pre className="text-[9px] font-mono text-zinc-700 bg-white/[0.02] rounded px-2 py-1.5 overflow-x-auto max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all">
            {entry.dataPreview}
          </pre>
          {entry.pipeName && (
            <div className="text-[8px] font-mono text-zinc-800 mt-1">pipe: {entry.pipeName}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortActivityLog — slides out, draggable height
// ---------------------------------------------------------------------------

const MIN_HEIGHT = 28;   // collapsed — just the header bar
const DEFAULT_HEIGHT = 120;
const MAX_HEIGHT = 400;

interface PortActivityLogProps {
  appId: string;
}

function PortConnections({ appId }: { appId: string }) {
  const { getPortCatalog, createPipe, deletePipe, pushPipe, pipes } = useDataBus();
  const catalog = getPortCatalog();
  const thisApp = catalog.find(c => c.appId === appId);
  if (!thisApp) return null;

  const hasOutputs = thisApp.outputs.length > 0;
  const hasInputs = thisApp.inputs.length > 0;
  if (!hasOutputs && !hasInputs) return null;

  // Find existing pipes involving this app
  const myPipes = pipes.filter(
    p => p.source.appId === appId || p.sink.appId === appId,
  );

  // Find compatible targets for each output
  const outputTargets = thisApp.outputs.flatMap(out => {
    return catalog
      .filter(c => c.appId !== appId)
      .flatMap(c =>
        c.inputs
          .filter(inp => inp.dataType === out.dataType || out.dataType === 'json')
          .map(inp => ({
            output: out,
            targetAppId: c.appId,
            targetAppName: c.appName,
            input: inp,
            existingPipe: myPipes.find(
              p => p.source.appId === appId && p.source.portId === out.id &&
                   p.sink.appId === c.appId && p.sink.portId === inp.id,
            ),
          })),
      );
  });

  // Find compatible sources for each input
  const inputSources = thisApp.inputs.flatMap(inp => {
    return catalog
      .filter(c => c.appId !== appId)
      .flatMap(c =>
        c.outputs
          .filter(out => out.dataType === inp.dataType || out.dataType === 'json')
          .map(out => ({
            input: inp,
            sourceAppId: c.appId,
            sourceAppName: c.appName,
            output: out,
            existingPipe: myPipes.find(
              p => p.sink.appId === appId && p.sink.portId === inp.id &&
                   p.source.appId === c.appId && p.source.portId === out.id,
            ),
          })),
      );
  });

  const handleConnect = async (srcAppId: string, srcPortId: string, sinkAppId: string, sinkPortId: string) => {
    await createPipe({
      name: `${srcAppId}:${srcPortId} → ${sinkAppId}:${sinkPortId}`,
      source: { appId: srcAppId, portId: srcPortId },
      sink: { appId: sinkAppId, portId: sinkPortId },
      enabled: true,
    });
  };

  const handleDisconnect = async (pipe: PipeDefinition) => {
    await deletePipe(pipe.id);
  };

  return (
    <div className="px-2 py-1.5 space-y-1.5">
      {/* Outputs → available targets */}
      {outputTargets.length > 0 && (
        <div>
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-800 mb-1">Send to</div>
          {outputTargets.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              <span className="text-[9px] font-mono text-cyan-600 truncate">{t.output.name}</span>
              <ArrowRight size={8} className="text-zinc-800 shrink-0" />
              <span className="text-[9px] font-mono text-zinc-600 truncate">{t.targetAppName}</span>
              <span className="text-[8px] font-mono text-zinc-800">({t.input.name})</span>
              <span className="ml-auto shrink-0 flex gap-0.5">
                {t.existingPipe ? (
                  <>
                    <button
                      onClick={() => pushPipe(t.existingPipe!.id)}
                      className="p-0.5 rounded hover:bg-emerald-500/15 text-emerald-400/50 hover:text-emerald-400 transition-colors"
                      title="Push data now"
                    >
                      <Play size={8} />
                    </button>
                    <button
                      onClick={() => handleDisconnect(t.existingPipe!)}
                      className="p-0.5 rounded hover:bg-red-500/15 text-red-400/40 hover:text-red-400 transition-colors"
                      title="Disconnect"
                    >
                      <Unlink size={8} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(appId, t.output.id, t.targetAppId, t.input.id)}
                    className="p-0.5 rounded hover:bg-cyan-500/15 text-zinc-700 hover:text-cyan-400 transition-colors"
                    title="Connect"
                  >
                    <Link size={8} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Available sources → Inputs */}
      {inputSources.length > 0 && (
        <div>
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-800 mb-1">Receive from</div>
          {inputSources.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              <span className="text-[9px] font-mono text-zinc-600 truncate">{s.sourceAppName}</span>
              <span className="text-[8px] font-mono text-zinc-800">({s.output.name})</span>
              <ArrowRight size={8} className="text-zinc-800 shrink-0" />
              <span className="text-[9px] font-mono text-emerald-400/50 truncate">{s.input.name}</span>
              <span className="ml-auto shrink-0 flex gap-0.5">
                {s.existingPipe ? (
                  <>
                    <button
                      onClick={() => pushPipe(s.existingPipe!.id)}
                      className="p-0.5 rounded hover:bg-emerald-500/15 text-emerald-400/50 hover:text-emerald-400 transition-colors"
                      title="Pull data now"
                    >
                      <Play size={8} />
                    </button>
                    <button
                      onClick={() => handleDisconnect(s.existingPipe!)}
                      className="p-0.5 rounded hover:bg-red-500/15 text-red-400/40 hover:text-red-400 transition-colors"
                      title="Disconnect"
                    >
                      <Unlink size={8} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(s.sourceAppId, s.output.id, appId, s.input.id)}
                    className="p-0.5 rounded hover:bg-cyan-500/15 text-zinc-700 hover:text-cyan-400 transition-colors"
                    title="Connect"
                  >
                    <Link size={8} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortActivityLog({ appId }: PortActivityLogProps) {
  const activity = usePortActivity(appId);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const isOpen = height > MIN_HEIGHT;
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - ev.clientY; // dragging up = taller
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startH + dy));
      setHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height]);

  const toggleOpen = useCallback(() => {
    setHeight(h => h <= MIN_HEIGHT ? DEFAULT_HEIGHT : MIN_HEIGHT);
  }, []);

  const recentCount = activity.filter(e => Date.now() - e.timestamp < 60000).length;

  return (
    <div style={{ height }}>
      {/* Drag handle + header */}
      <div
        className="flex items-center gap-2 px-2.5 h-[28px] shrink-0 cursor-row-resize select-none group"
        onMouseDown={handleDragStart}
        onDoubleClick={toggleOpen}
      >
        <GripHorizontal size={10} className="text-zinc-800 group-hover:text-zinc-700 transition-colors" />
        <button
          onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
          onMouseDown={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          <Activity size={9} />
          Ports
        </button>
        {recentCount > 0 && (
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-500">
            {recentCount}
          </span>
        )}
        <span className="text-[9px] font-mono text-zinc-800 ml-auto">
          {activity.length > 0 ? `${activity.length}` : ''}
        </span>
      </div>

      {/* Connections + Activity — only when open */}
      {isOpen && (
        <div className="overflow-y-auto frame-scrollbar" style={{ height: height - 28 }}>
          <PortConnections appId={appId} />
          {activity.length > 0 && (
            <div className="border-t border-white/[0.04]">
              {activity.map(entry => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
