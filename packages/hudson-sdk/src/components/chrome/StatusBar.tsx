'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Map, Maximize2 } from 'lucide-react';
import { PANEL_STYLES } from '../../lib/theme';

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
  emerald: { dot: 'bg-success', ping: 'bg-success', text: 'text-success' },
  amber: { dot: 'bg-warning', ping: 'bg-warning', text: 'text-warning' },
  red: { dot: 'bg-destructive', ping: 'bg-destructive', text: 'text-destructive' },
  neutral: { dot: 'bg-muted-foreground', ping: 'bg-muted-foreground', text: 'text-muted-foreground' },
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
      className={`${PANEL_STYLES.statusBar} h-7 flex items-center justify-between px-3 select-none font-mono text-[12px] text-foreground pointer-events-auto`}
    >
      {/* LEFT: Minimap toggle + Status indicator + App-specific */}
      <div className="flex items-center gap-4">
        {/* Collapsed minimap toggle */}
        {isMinimapCollapsed && onExpandMinimap && (
          <>
            <button
              onClick={onExpandMinimap}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 border border-border/70 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              title="Expand minimap"
            >
              <Map size={10} />
              <span className="text-[11px] font-bold">MAP</span>
              <Maximize2 size={8} className="opacity-60" />
            </button>
            <div className="h-3 w-px bg-border" />
          </>
        )}

        {/* System status indicator */}
        <div className={`flex items-center gap-2 ${colors.text}`}>
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.ping} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.dot}`} />
          </div>
          <span className="font-bold tracking-wider">{status.label}</span>
        </div>

        {left && (
          <>
            <div className="h-3 w-px bg-border" />
            {left}
          </>
        )}
      </div>

      {/* CENTER: Viewport data (clickable to copy) */}
      {viewport && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopyViewport}
            className="flex items-center gap-3 hover:text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
            title="Copy viewport data"
          >
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">PAN:</span>
              <span className={`tabular-nums ${vpCopied ? 'text-accent' : ''}`}>
                {viewport.pan.x.toFixed(0)},{viewport.pan.y.toFixed(0)}
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">SIZE:</span>
              <span className={`tabular-nums ${vpCopied ? 'text-accent' : ''}`}>
                {viewport.canvasSize?.w ?? 1024}x{viewport.canvasSize?.h ?? 1024}
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">ZOOM:</span>
              <span className={`tabular-nums ${vpCopied ? 'text-accent' : ''}`}>
                {(viewport.zoom * 100).toFixed(0)}%
              </span>
            </div>
          </button>
        </div>
      )}

      {/* RIGHT: Console toggle + Clock */}
      <div className="flex items-center gap-4">
        {right}

        {right && <div className="h-3 w-px bg-border" />}

        {onToggleTerminal && (
          <>
            <button
              onClick={onToggleTerminal}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                isTerminalOpen
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent'
              }`}
              title="Toggle Terminal (Ctrl+`)"
            >
              <span className="text-[12px]">{'>'}_</span>
              <span className="uppercase text-[11px] font-semibold tracking-wider">Console</span>
            </button>
            <div className="h-3 w-px bg-border" />
          </>
        )}

        <div className="flex items-center gap-1.5 text-foreground min-w-[60px] justify-end">
          <Clock size={11} className="text-muted-foreground" />
          <span>{mounted ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
