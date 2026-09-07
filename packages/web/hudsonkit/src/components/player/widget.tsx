'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  Film,
  ListMusic,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  PictureInPicture2,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SHELL_THEME } from '../../lib/theme';
import { usePlayer } from './PlayerProvider';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const STATUS_H = SHELL_THEME.layout.statusBarHeight;
const PANEL_BOTTOM = STATUS_H;
const MIN_H = 120;
const PLAYER_PANEL_OFFSET_VAR = '--hud-player-panel-offset';
const PLAYER_STATUS_OFFSET_VAR = '--hud-player-status-inline-offset';
const PLAYER_STATUS_OFFSET = '118px';
const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function formatDuration(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '--:--';
  const total = Math.max(0, Math.round(s));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function useLocalState(key: string, init: number): [number, (v: number) => void] {
  const [val, setVal] = useState<number>(() => {
    if (typeof window === 'undefined') return init;
    try { const s = window.localStorage.getItem(key); return s ? parseFloat(s) : init; } catch { return init; }
  });
  const set = (v: number) => { setVal(v); try { window.localStorage.setItem(key, String(v)); } catch {} };
  return [val, set];
}

// ─────────────────────────────────────────────────────────────────────────
// VolumeControl — lives in the panel header
// ─────────────────────────────────────────────────────────────────────────

function VolumeControl() {
  const { volume, setVolume } = usePlayer();
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
        className="p-0.5 rounded transition-colors hover:bg-white/[0.06] text-muted-foreground hover:text-foreground"
        title="Mute (M)"
      >
        <VolumeIcon size={12} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={volume}
        onChange={e => setVolume(parseFloat(e.target.value))}
        className="w-20 h-1 cursor-pointer"
        style={{ accentColor: 'var(--hud-accent)' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PlayerVideoStage — the host container for the shared <video> element
// ─────────────────────────────────────────────────────────────────────────

export function PlayerVideoStage({ priority = 10 }: { priority?: number }) {
  const { attachStage, togglePip, isPip, pipSupported } = usePlayer();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => attachStage(ref.current, { priority }), [attachStage, priority]);
  return (
    <div className="shrink-0 relative bg-black w-full group" style={{ aspectRatio: '16 / 9' }}>
      <div ref={ref} className="absolute inset-0" />
      {pipSupported && (
        <button
          type="button"
          onClick={togglePip}
          className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
          title={isPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
        >
          <PictureInPicture2 size={12} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PlayerNowPlaying — title, transport, scrubber, shuffle/repeat
// ─────────────────────────────────────────────────────────────────────────

export function PlayerNowPlaying() {
  const {
    media, playing, currentTime, duration,
    togglePlay, seek, next, prev, queue,
    shuffle, repeat, toggleShuffle, cycleRepeat,
  } = usePlayer();
  if (!media) return null;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const title = media.title ?? media.id;
  const KindIcon = media.kind === 'video' ? Film : Music2;
  const hasQueue = queue.length > 1;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const repeatLabel = repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one';

  return (
    <div className="shrink-0 flex" style={{ borderBottom: '1px solid var(--hud-chrome-border-subtle)' }}>
      {/* Left rail — placeholder for future playlist/category nav */}
      <div
        className="shrink-0 w-12 flex items-start justify-center pt-3 text-white/15"
        style={{ borderRight: '1px solid var(--hud-chrome-border-subtle)' }}
        title="Playlists (coming soon)"
      >
        <ListMusic size={13} />
      </div>

      {/* Center column — title, transport, scrubber */}
      <div className="flex-1 flex flex-col gap-2 px-4 py-3 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <KindIcon size={11} className="shrink-0 text-muted-foreground/70" />
          <span className="text-[12px] font-medium truncate text-foreground/85">{title}</span>
          {media.artist && (
            <span className="text-[10px] font-mono shrink-0 text-muted-foreground/70">· {media.artist}</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prev}
            disabled={!hasQueue && currentTime < 3}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="Previous (P)"
          >
            <SkipBack size={13} fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'color-mix(in oklch, var(--hud-accent) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--hud-accent) 30%, transparent)',
              color: 'var(--hud-accent)',
            }}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-[1px]" />}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!hasQueue}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="Next (N)"
          >
            <SkipForward size={13} fill="currentColor" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <div
            className="relative h-1 rounded-full cursor-pointer bg-white/[0.08]"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration); }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${pct}%`, background: 'color-mix(in oklch, var(--hud-accent) 70%, transparent)' }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-muted-foreground/70">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </div>

      {/* Right rail — shuffle, repeat */}
      <div
        className="shrink-0 w-12 flex flex-col items-center justify-center gap-2"
        style={{ borderLeft: '1px solid var(--hud-chrome-border-subtle)' }}
      >
        <button
          type="button"
          onClick={toggleShuffle}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-white/[0.06]"
          style={{ color: shuffle ? 'var(--hud-accent)' : 'var(--hud-muted)' }}
          title={shuffle ? 'Shuffle on' : 'Shuffle off'}
        >
          <Shuffle size={13} />
        </button>
        <button
          type="button"
          onClick={cycleRepeat}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-white/[0.06]"
          style={{ color: repeat === 'off' ? 'var(--hud-muted)' : 'var(--hud-accent)' }}
          title={repeatLabel}
        >
          <RepeatIcon size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PlayerStatusBarPill — the centered toggle pill that sits inside the status bar
// ─────────────────────────────────────────────────────────────────────────

export function PlayerStatusBarPill({ pipActive = false }: { pipActive?: boolean }) {
  const { playing, isPlayerOpen, togglePlayer, togglePlay, media } = usePlayer();
  const hasMedia = media != null;
  const isVideo = media?.kind === 'video';
  const visible = pipActive || isPlayerOpen || hasMedia;
  const open = pipActive || isPlayerOpen;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty(PLAYER_STATUS_OFFSET_VAR);
      return;
    }
    root.style.setProperty(PLAYER_STATUS_OFFSET_VAR, PLAYER_STATUS_OFFSET);
    return () => {
      root.style.removeProperty(PLAYER_STATUS_OFFSET_VAR);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed -translate-x-1/2 flex items-center rounded transition-all"
      style={{
        bottom: 0,
        left: `calc(50% + var(${PLAYER_STATUS_OFFSET_VAR}, 0px))`,
        height: STATUS_H,
        zIndex: SHELL_THEME.zIndex.statusBar + 5,
        color: open ? 'var(--hud-accent)' : 'var(--hud-muted)',
        background: open ? 'color-mix(in oklch, var(--hud-accent) 8%, transparent)' : 'transparent',
        border: `1px solid ${open ? 'color-mix(in oklch, var(--hud-accent) 30%, transparent)' : 'transparent'}`,
      }}
    >
      <button
        type="button"
        onClick={hasMedia ? togglePlay : togglePlayer}
        className="flex items-center justify-center pl-2 pr-1 h-full transition-colors hover:opacity-80"
        title={hasMedia ? (playing ? 'Pause' : 'Play') : 'Open Player'}
      >
        {playing ? <Pause size={10} fill="currentColor" /> : (isVideo ? <Film size={11} /> : <Music2 size={11} />)}
      </button>
      <button
        type="button"
        onClick={togglePlayer}
        className="pr-2 h-full uppercase text-[11px] font-semibold tracking-wider"
      >
        {pipActive ? 'In Window' : 'Player'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Document PiP hook — pops the panel into a floating OS window (Chromium-only)
// ─────────────────────────────────────────────────────────────────────────

interface DocPipApi {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
}

function getDocPip(): DocPipApi | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { documentPictureInPicture?: DocPipApi };
  return w.documentPictureInPicture ?? null;
}

function useDocPip(enabled: boolean) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const supported = enabled && !!getDocPip();

  const toggle = useCallback(async () => {
    const api = enabled ? getDocPip() : null;
    if (!api) return;
    if (pipWindow) { pipWindow.close(); setPipWindow(null); return; }
    try {
      const w = await api.requestWindow({ width: 380, height: 320 });
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          const rules = sheet.cssRules;
          const style = w.document.createElement('style');
          style.textContent = Array.from(rules).map(r => r.cssText).join('\n');
          w.document.head.appendChild(style);
        } catch {
          if (sheet.href) {
            const link = w.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            w.document.head.appendChild(link);
          }
        }
      });
      const body = w.document.body;
      body.style.margin = '0';
      body.style.background = 'var(--hud-bg, rgb(12, 12, 16))';
      body.style.color = 'var(--hud-ink, #ededed)';
      body.style.fontFamily = 'var(--hud-font-sans, system-ui, sans-serif)';
      body.style.fontSize = '13px';
      const onClose = () => setPipWindow(null);
      w.addEventListener('pagehide', onClose);
      setPipWindow(w);
    } catch {
      // user denied or feature unavailable
    }
  }, [enabled, pipWindow]);

  // Hard cleanup: close the PiP window on unmount so HMR doesn't leave it orphaned.
  useEffect(() => () => { pipWindow?.close(); }, [pipWindow]);

  return { supported, pipWindow, toggle };
}

// ─────────────────────────────────────────────────────────────────────────
// PlayerPanel — the drawer body. Children render under NowPlaying (queue slot).
// ─────────────────────────────────────────────────────────────────────────

export interface PlayerPanelProps {
  children?: ReactNode;
  /** Render content even when no media is loaded. Default: true (so the queue is reachable). */
  showWhenEmpty?: boolean;
  /** Window-mode flag — set internally when rendered inside a Document PiP window. */
  pipMode?: boolean;
  /** Render the "pop out" affordance in the header. Default: true if Document PiP is supported. */
  showDocPipToggle?: boolean;
  /** Document PiP active state — supplied by PlayerWidget. */
  docPipActive?: boolean;
  /** Document PiP toggle handler — supplied by PlayerWidget. */
  onToggleDocPip?: () => void;
  /** localStorage key for the persisted resize height. Default: 'hudson.player.panelH'. */
  heightKey?: string;
}

export function PlayerPanel({
  children,
  showWhenEmpty = true,
  pipMode = false,
  showDocPipToggle = false,
  docPipActive = false,
  onToggleDocPip,
  heightKey = 'hudson.player.panelH',
}: PlayerPanelProps) {
  const { isPlayerOpen, togglePlayer, media } = usePlayer();
  const [height, setHeight] = useLocalState(heightKey, 220);
  const [maximized, setMaximized] = useState(false);
  const [draggingPanel, setDraggingPanel] = useState(false);
  const dragging = useRef(false);

  const panelH = pipMode
    ? '100vh'
    : maximized
      ? (typeof window !== 'undefined' ? `${window.innerHeight - STATUS_H}px` : '500px')
      : `${height}px`;

  useEffect(() => {
    if (pipMode || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isPlayerOpen) {
      root.style.setProperty(PLAYER_PANEL_OFFSET_VAR, panelH);
    } else {
      root.style.removeProperty(PLAYER_PANEL_OFFSET_VAR);
    }
    return () => {
      root.style.removeProperty(PLAYER_PANEL_OFFSET_VAR);
    };
  }, [isPlayerOpen, panelH, pipMode]);

  const onGripMouseDown = (e: React.MouseEvent) => {
    if (pipMode || maximized || typeof window === 'undefined') return;
    e.preventDefault();
    dragging.current = true;
    setDraggingPanel(true);
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_H, Math.min(window.innerHeight - STATUS_H, startH + (startY - ev.clientY)));
      setHeight(next);
    };
    const onUp = () => {
      dragging.current = false;
      setDraggingPanel(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const isVideo = media?.kind === 'video';
  if (!showWhenEmpty && !media) return null;

  const containerStyle: React.CSSProperties = pipMode
    ? { position: 'static', height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    : {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: PANEL_BOTTOM,
        height: isPlayerOpen ? panelH : 0,
        zIndex: SHELL_THEME.zIndex.statusBar + 4,
        borderTop: isPlayerOpen ? '1px solid var(--hud-chrome-border-subtle)' : 'none',
        boxShadow: isPlayerOpen ? '0 -8px 32px rgba(0,0,0,0.6)' : 'none',
        overflow: 'hidden',
        transition: draggingPanel ? 'none' : 'height 250ms ease',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div style={containerStyle} className="bg-card/95 backdrop-blur-xl text-foreground">
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-3 h-9 select-none"
        style={{ borderBottom: '1px solid var(--hud-chrome-border-subtle)' }}
      >
        <div className="flex items-center gap-2 shrink-0" style={{ color: 'var(--hud-accent)' }}>
          {isVideo ? <Film size={13} /> : <Music2 size={13} />}
          <span className="text-xs font-bold tracking-widest font-mono">PLAYER</span>
        </div>
        <div className="shrink-0">
          <VolumeControl />
        </div>
        <div
          className={`flex-1 flex justify-center items-center h-full group ${pipMode ? '' : 'cursor-ns-resize'}`}
          onMouseDown={onGripMouseDown}
        >
          {!pipMode && <div className="w-12 h-1 rounded-full bg-white/[0.15]" />}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showDocPipToggle && onToggleDocPip && (
            <button
              type="button"
              onClick={onToggleDocPip}
              className="p-1 rounded transition-colors hover:bg-white/[0.06]"
              style={{ color: docPipActive ? 'var(--hud-accent)' : 'var(--hud-muted)' }}
              title={docPipActive ? 'Return to main window' : 'Pop out to floating window'}
            >
              <ExternalLink size={13} />
            </button>
          )}
          {!pipMode && (
            <button
              type="button"
              onClick={() => setMaximized(m => !m)}
              className="p-1 rounded transition-colors hover:bg-white/[0.06] text-muted-foreground"
            >
              {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          {!pipMode && (
            <button
              type="button"
              onClick={togglePlayer}
              className="p-1 rounded transition-colors hover:bg-red-500/10 text-muted-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isVideo && <PlayerVideoStage />}
      <PlayerNowPlaying />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PlayerWidget — convenience: portals StatusBarPill + PlayerPanel to body
// ─────────────────────────────────────────────────────────────────────────

export interface PlayerWidgetProps {
  /** Content slot inside the panel below NowPlaying (typically a queue list). */
  children?: ReactNode;
  /** Allow popping the panel into a floating OS window (Chromium-only). Default: true. */
  enableDocumentPiP?: boolean;
  /** localStorage key for the persisted resize height. */
  heightKey?: string;
}

export function PlayerWidget({ children, enableDocumentPiP = true, heightKey }: PlayerWidgetProps) {
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
  const { supported: docPipSupported, pipWindow, toggle: toggleDocPip } = useDocPip(enableDocumentPiP);
  if (!mounted) return null;
  const docPipActive = pipWindow != null;
  const panel = (
    <PlayerPanel
      pipMode={docPipActive}
      showDocPipToggle={docPipSupported}
      docPipActive={docPipActive}
      onToggleDocPip={toggleDocPip}
      heightKey={heightKey}
    >
      {children}
    </PlayerPanel>
  );
  const panelTarget = docPipActive && pipWindow ? pipWindow.document.body : document.body;
  return (
    <>
      {createPortal(<PlayerStatusBarPill pipActive={docPipActive} />, document.body)}
      {createPortal(panel, panelTarget)}
    </>
  );
}
