import React, { useState, useEffect } from 'react';
import { Activity, Clock, Map, Maximize2, Terminal } from 'lucide-react';
import { PANEL_STYLES } from '../../lib/chrome';

interface StatusBarProps {
  /** Left section content — app-specific status items */
  left?: React.ReactNode;
  /** Viewport data for the center section */
  viewport?: {
    pan: { x: number; y: number };
    zoom: number;
    canvasSize?: { w: number; h: number };
  };
  /** Right section content — app-specific items before system info */
  right?: React.ReactNode;
  /** Whether the minimap is collapsed (shows MAP button in status bar) */
  isMinimapCollapsed?: boolean;
  /** Callback to expand the minimap */
  onExpandMinimap?: () => void;
  /** Status label and color for the online indicator */
  status?: { label: string; color: 'emerald' | 'amber' | 'red' | 'neutral' };
  /** Callback to toggle the terminal drawer */
  onToggleTerminal?: () => void;
  /** Whether the terminal is currently open */
  isTerminalOpen?: boolean;
}

const STATUS_COLORS = {
  emerald: { dot: 'bg-emerald-500', ping: 'bg-emerald-400', text: 'text-emerald-500' },
  amber: { dot: 'bg-amber-500', ping: 'bg-amber-400', text: 'text-amber-500' },
  red: { dot: 'bg-red-500', ping: 'bg-red-400', text: 'text-red-500' },
  neutral: { dot: 'bg-neutral-500', ping: 'bg-neutral-400', text: 'text-neutral-500' },
};

const StatusBar: React.FC<StatusBarProps> = ({
  left,
  viewport,
  right,
  isMinimapCollapsed = false,
  onExpandMinimap,
  status = { label: 'READY', color: 'emerald' },
  onToggleTerminal,
  isTerminalOpen = false,
}) => {
  const [time, setTime] = useState(new Date());
  const [vpCopied, setVpCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const colors = STATUS_COLORS[status.color];

  const handleCopyViewport = async () => {
    if (!viewport) return;
    const payload = `PAN: ${viewport.pan.x.toFixed(0)},${viewport.pan.y.toFixed(0)} | SIZE: ${viewport.canvasSize?.w ?? 1024}x${viewport.canvasSize?.h ?? 1024} | ZOOM: ${(viewport.zoom * 100).toFixed(0)}%`;
    try {
      await navigator.clipboard.writeText(payload);
      setVpCopied(true);
      setTimeout(() => setVpCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div
      data-frame-panel="status-bar"
      className={`${PANEL_STYLES.statusBar} h-7 flex items-center justify-between px-3 select-none font-mono text-[10px] text-neutral-500 pointer-events-auto`}
    >
      {/* LEFT: Minimap toggle + Status indicator + App-specific */}
      <div className="flex items-center gap-4">
        {/* Collapsed minimap toggle */}
        {isMinimapCollapsed && onExpandMinimap && (
          <>
            <button
              onClick={onExpandMinimap}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-neutral-800 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              title="Expand minimap"
            >
              <Map size={10} />
              <span className="text-[9px] font-bold">MAP</span>
              <Maximize2 size={8} className="opacity-60" />
            </button>
            <div className="h-3 w-px bg-neutral-800" />
          </>
        )}

        {/* Status indicator */}
        <div className={`flex items-center gap-2 ${colors.text}`}>
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.ping} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.dot}`} />
          </div>
          <span className="font-bold tracking-wider">{status.label}</span>
        </div>

        {left && (
          <>
            <div className="h-3 w-px bg-neutral-800" />
            {left}
          </>
        )}
      </div>

      {/* CENTER: Viewport data (clickable to copy) */}
      {viewport && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopyViewport}
            className="flex items-center gap-3 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Copy viewport data"
          >
            <div className="flex items-center gap-1">
              <span className="text-neutral-600">PAN:</span>
              <span className={`tabular-nums ${vpCopied ? 'text-emerald-500' : ''}`}>
                {viewport.pan.x.toFixed(0)},{viewport.pan.y.toFixed(0)}
              </span>
            </div>
            <div className="h-3 w-px bg-neutral-800" />
            <div className="flex items-center gap-1">
              <span className="text-neutral-600">SIZE:</span>
              <span className={`tabular-nums ${vpCopied ? 'text-emerald-500' : ''}`}>
                {viewport.canvasSize?.w ?? 1024}x{viewport.canvasSize?.h ?? 1024}
              </span>
            </div>
            <div className="h-3 w-px bg-neutral-800" />
            <div className="flex items-center gap-1">
              <span className="text-neutral-600">ZOOM:</span>
              <span className={`tabular-nums ${vpCopied ? 'text-emerald-500' : ''}`}>
                {(viewport.zoom * 100).toFixed(0)}%
              </span>
            </div>
          </button>
        </div>
      )}

      {/* RIGHT: App-specific + System info + Clock */}
      <div className="flex items-center gap-4">
        {right}

        {right && <div className="h-3 w-px bg-neutral-800" />}

        {onToggleTerminal && (
          <>
            <button
              onClick={onToggleTerminal}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
                isTerminalOpen
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5 border border-transparent'
              }`}
              title="Toggle Terminal (Ctrl+`)"
            >
              <span className="text-[12px]">{'>'}_</span>
              <span className="uppercase text-[9px] font-semibold tracking-wider">
                {isTerminalOpen ? 'Console' : 'Console'}
              </span>
            </button>
            <div className="h-3 w-px bg-neutral-800" />
          </>
        )}

        <div className="flex items-center gap-1.5">
          <Activity size={10} className="text-neutral-600" />
          <span className="uppercase text-neutral-400">System: Nominal</span>
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        <div className="flex items-center gap-1.5 text-neutral-300 min-w-[60px] justify-end">
          <Clock size={10} className="text-neutral-600" />
          <span>{mounted ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
