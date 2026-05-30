'use client';

import {
  default as React,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MediaItem, RepeatMode, StoredQueueItem } from '../../types/media';

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_PERSISTENCE_KEY = 'hudson.player';
const HISTORY_MAX = 40;
const POSITION_SAVE_MIN = 1;
const POSITION_SAVE_TAIL = 2;

interface StorageKeys {
  volume: string;
  repeat: string;
  shuffle: string;
  positions: string;
  queue: string;
  queueIndex: string;
}

function makeStorageKeys(base: string): StorageKeys {
  // Use `:` as the separator so colon-style consumer bases (e.g. 'foo:player')
  // produce 'foo:player:volume', and dot-style bases ('hudson.player') produce
  // 'hudson.player:volume'. Consistent and unambiguous.
  return {
    volume: `${base}:volume`,
    repeat: `${base}:repeat`,
    shuffle: `${base}:shuffle`,
    positions: `${base}:positions`,
    queue: `${base}:queue`,
    queueIndex: `${base}:queueIndex`,
  };
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────

export interface HistoryItem {
  kind: 'audio' | 'video';
  id: string;
  title: string;
}

export interface PlayMediaOpts {
  /** Replace the active queue with this list. */
  queue?: MediaItem[];
  /** Index inside the new queue. Defaults to the item's position. */
  index?: number;
  /** Load src and restore position but don't auto-play. Default true. */
  autoplay?: boolean;
}

export interface AttachStageOpts {
  /** Higher wins when multiple hosts attach simultaneously. */
  priority?: number;
  /** Show native browser controls while attached here. */
  controls?: boolean;
}

export interface PlayerContextValue {
  media: MediaItem | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isPlayerOpen: boolean;
  isPip: boolean;
  pipSupported: boolean;
  /** True when the current media's src failed to load. */
  loadError: boolean;
  history: HistoryItem[];
  queue: MediaItem[];
  queueIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playMedia: (m: MediaItem, opts?: PlayMediaOpts) => void;
  /** Load src + restore position without auto-playing. */
  loadMedia: (m: MediaItem) => void;
  /** Insert after the currently-playing item. Falls back to playMedia if empty. */
  insertNext: (m: MediaItem) => void;
  /** Append to end of queue. Falls back to playMedia if empty. */
  addToQueue: (m: MediaItem) => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  openPlayer: () => void;
  togglePlayer: () => void;
  logHistory: (item: HistoryItem) => void;
  togglePip: () => Promise<void>;
  mediaEl: HTMLVideoElement | null;
  /**
   * Adopt the media element into the given container. Returns a detach fn.
   * Multiple hosts can attach at once; the highest-priority host wins.
   */
  attachStage: (container: HTMLElement | null, opts?: AttachStageOpts) => () => void;
}

export interface PlayerProviderProps {
  children: ReactNode;
  /**
   * Rehydrate a persisted queue ID back into a full MediaItem.
   * Return null/undefined to drop the item silently.
   */
  resolveItem?: (kind: 'audio' | 'video', id: string) => MediaItem | null | undefined;
  /**
   * Return false to suspend the global keyboard handler — e.g. when a modal
   * elsewhere is capturing input. Default: always true.
   */
  shouldCaptureKeys?: () => boolean;
  /** Wire up Space/J/K/L/arrows/M/N/P globally. Default: true. */
  enableGlobalShortcuts?: boolean;
  /** Allow the player to pop its panel into a floating window (Chromium-only). Default: true. */
  enableDocumentPiP?: boolean;
  /** Album name shown in Media Session metadata. Default: 'Hudson'. */
  appName?: string;
  /** localStorage key prefix. Default: 'hudson.player'. */
  persistenceKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

interface StageEntry { container: HTMLElement; priority: number; controls: boolean; }

function pushHistory(prev: HistoryItem[], item: HistoryItem): HistoryItem[] {
  const deduped = prev.filter(h => !(h.kind === item.kind && h.id === item.id));
  return [item, ...deduped].slice(0, HISTORY_MAX);
}

// ─────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────

export function PlayerProvider({
  children,
  resolveItem,
  shouldCaptureKeys,
  enableGlobalShortcuts = true,
  appName = 'Hudson',
  persistenceKey = DEFAULT_PERSISTENCE_KEY,
}: PlayerProviderProps) {
  const KEYS = useRef<StorageKeys>(makeStorageKeys(persistenceKey)).current;

  const homeRef = useRef<HTMLDivElement | null>(null);
  const stagesRef = useRef<StageEntry[]>([]);

  const [mediaEl, setMediaEl] = useState<HTMLVideoElement | null>(null);
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const v = parseFloat(loadString(KEYS.volume, '0.8'));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
  });
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isPip, setIsPip] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [queue, setQueue] = useState<MediaItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffle, setShuffle] = useState<boolean>(() => loadString(KEYS.shuffle, '0') === '1');
  const [repeat, setRepeat] = useState<RepeatMode>(() => {
    const v = loadString(KEYS.repeat, 'off');
    return v === 'one' || v === 'all' ? v : 'off';
  });
  const [positions, setPositions] = useState<Record<string, number>>(() => loadJSON(KEYS.positions, {}));

  const shuffleOrderRef = useRef<number[]>([]);
  useEffect(() => {
    if (shuffle && queue.length > 0) {
      const idxs = Array.from({ length: queue.length }, (_, i) => i);
      const rest = idxs.filter(i => i !== queueIndex);
      shuffleOrderRef.current = [queueIndex, ...shuffleArray(rest)];
    } else {
      shuffleOrderRef.current = Array.from({ length: queue.length }, (_, i) => i);
    }
  // queueIndex intentionally excluded — don't reshuffle on every track change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle, queue.length]);

  const pipSupported = typeof document !== 'undefined'
    && 'pictureInPictureEnabled' in document
    && (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled === true;

  // Persistence
  useEffect(() => { try { window.localStorage.setItem(KEYS.repeat, repeat); } catch {} }, [KEYS.repeat, repeat]);
  useEffect(() => { try { window.localStorage.setItem(KEYS.shuffle, shuffle ? '1' : '0'); } catch {} }, [KEYS.shuffle, shuffle]);
  useEffect(() => { try { window.localStorage.setItem(KEYS.positions, JSON.stringify(positions)); } catch {} }, [KEYS.positions, positions]);
  useEffect(() => {
    try {
      const stored: StoredQueueItem[] = queue.map(m => ({ kind: m.kind, id: m.id }));
      window.localStorage.setItem(KEYS.queue, JSON.stringify(stored));
      window.localStorage.setItem(KEYS.queueIndex, String(queueIndex));
    } catch {}
  }, [KEYS.queue, KEYS.queueIndex, queue, queueIndex]);

  // Refs holding the latest state for stable listeners
  const playRef = useRef<((m: MediaItem) => void) | null>(null);
  const queueRef = useRef<MediaItem[]>([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef<RepeatMode>('off');
  const positionsRef = useRef<Record<string, number>>({});
  const mediaRef = useRef<MediaItem | null>(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  useEffect(() => { mediaRef.current = media; }, [media]);

  // Create the single <video> element once
  useEffect(() => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.playsInline = true;
    el.controls = false;

    const savePosition = () => {
      const m = mediaRef.current;
      if (!m) return;
      const t = el.currentTime;
      const dur = el.duration;
      if (t > POSITION_SAVE_MIN && (!Number.isFinite(dur) || t < dur - POSITION_SAVE_TAIL)) {
        setPositions(prev => ({ ...prev, [`${m.kind}:${m.id}`]: t }));
      }
    };

    const onTime = () => setCurrentTime(el.currentTime);
    const onDur = () => { if (Number.isFinite(el.duration)) setDuration(el.duration); };
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); savePosition(); };
    const onVolumeChange = () => setVolumeState(el.volume);
    const onError = () => setLoadError(true);
    const onLoadedMeta = () => setLoadError(false);
    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);

    const onEnded = () => {
      const m = mediaRef.current;
      if (m) setPositions(prev => {
        const k = `${m.kind}:${m.id}`;
        if (!(k in prev)) return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      });
      const q = queueRef.current;
      if (q.length === 0) { setPlaying(false); return; }
      const r = repeatRef.current;
      if (r === 'one') { playRef.current?.(q[queueIndexRef.current]); return; }
      const order = shuffleOrderRef.current.length === q.length
        ? shuffleOrderRef.current
        : Array.from({ length: q.length }, (_, i) => i);
      const pos = order.indexOf(queueIndexRef.current);
      if (pos + 1 < order.length) {
        const idx = order[pos + 1];
        setQueueIndex(idx);
        playRef.current?.(q[idx]);
        return;
      }
      if (r === 'all') {
        const idx = order[0];
        setQueueIndex(idx);
        playRef.current?.(q[idx]);
        return;
      }
      setPlaying(false);
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('durationchange', onDur);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('volumechange', onVolumeChange);
    el.addEventListener('error', onError);
    el.addEventListener('loadedmetadata', onLoadedMeta);
    el.addEventListener('enterpictureinpicture', onEnterPip);
    el.addEventListener('leavepictureinpicture', onLeavePip);

    if (homeRef.current) homeRef.current.appendChild(el);
    setMediaEl(el);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('durationchange', onDur);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('volumechange', onVolumeChange);
      el.removeEventListener('error', onError);
      el.removeEventListener('loadedmetadata', onLoadedMeta);
      el.removeEventListener('enterpictureinpicture', onEnterPip);
      el.removeEventListener('leavepictureinpicture', onLeavePip);
      try { el.pause(); } catch {}
      el.removeAttribute('src');
      try { el.load(); } catch {}
      el.parentElement?.removeChild(el);
    };
  }, []);

  useEffect(() => {
    if (mediaEl) mediaEl.volume = volume;
    try { window.localStorage.setItem(KEYS.volume, String(volume)); } catch {}
  }, [KEYS.volume, volume, mediaEl]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const playOnElement = useCallback((next: MediaItem, autoplay = true) => {
    const el = mediaEl;
    if (!el) return;
    const sameSrc = mediaRef.current
      && mediaRef.current.kind === next.kind
      && mediaRef.current.id === next.id;
    setMedia(next);
    setHistory(prev => pushHistory(prev, {
      kind: next.kind, id: next.id, title: next.title ?? next.id,
    }));
    if (!sameSrc) {
      setLoadError(false);
      el.src = next.src;
      el.load();
      el.volume = volume;
      const key = `${next.kind}:${next.id}`;
      const onCanPlay = () => {
        el.volume = volume;
        const saved = positionsRef.current[key];
        const dur = el.duration;
        if (saved != null && saved > POSITION_SAVE_MIN
            && (!Number.isFinite(dur) || saved < dur - POSITION_SAVE_TAIL)) {
          el.currentTime = saved;
        }
        el.removeEventListener('canplay', onCanPlay);
      };
      el.addEventListener('canplay', onCanPlay);
    }
    if (autoplay) {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      setIsPlayerOpen(true);
    }
  }, [mediaEl, volume]);

  useEffect(() => { playRef.current = playOnElement; }, [playOnElement]);

  const playMedia = useCallback((next: MediaItem, opts?: PlayMediaOpts) => {
    if (opts?.queue && opts.queue.length > 0) {
      setQueue(opts.queue);
      const explicit = opts.index ?? -1;
      const inferred = opts.queue.findIndex(m => m.kind === next.kind && m.id === next.id);
      const idx = explicit >= 0 && explicit < opts.queue.length ? explicit
        : inferred >= 0 ? inferred : 0;
      setQueueIndex(idx);
    } else if (opts?.autoplay !== false) {
      setQueue([next]);
      setQueueIndex(0);
    }
    playOnElement(next, opts?.autoplay !== false);
  }, [playOnElement]);

  const loadMedia = useCallback((m: MediaItem) => playMedia(m, { autoplay: false }), [playMedia]);

  const insertNext = useCallback((m: MediaItem) => {
    if (queueRef.current.length === 0) { playMedia(m); return; }
    setQueue(prev => {
      const out = [...prev];
      out.splice(queueIndexRef.current + 1, 0, m);
      return out;
    });
  }, [playMedia]);

  const addToQueue = useCallback((m: MediaItem) => {
    if (queueRef.current.length === 0) { playMedia(m); return; }
    setQueue(prev => [...prev, m]);
  }, [playMedia]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const order = shuffleOrderRef.current.length === q.length
      ? shuffleOrderRef.current
      : Array.from({ length: q.length }, (_, i) => i);
    const pos = order.indexOf(queueIndexRef.current);
    let nextIdx: number;
    if (pos + 1 < order.length) nextIdx = order[pos + 1];
    else if (repeatRef.current === 'all') nextIdx = order[0];
    else return;
    setQueueIndex(nextIdx);
    playOnElement(q[nextIdx]);
  }, [playOnElement]);

  const prev = useCallback(() => {
    const el = mediaEl;
    const q = queueRef.current;
    if (q.length === 0) return;
    if (el && el.currentTime > 3) { el.currentTime = 0; return; }
    const order = shuffleOrderRef.current.length === q.length
      ? shuffleOrderRef.current
      : Array.from({ length: q.length }, (_, i) => i);
    const pos = order.indexOf(queueIndexRef.current);
    let prevIdx: number;
    if (pos - 1 >= 0) prevIdx = order[pos - 1];
    else if (repeatRef.current === 'all') prevIdx = order[order.length - 1];
    else { if (el) el.currentTime = 0; return; }
    setQueueIndex(prevIdx);
    playOnElement(q[prevIdx]);
  }, [playOnElement, mediaEl]);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const cycleRepeat = useCallback(() => {
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  }, []);

  const pause = useCallback(() => { mediaEl?.pause(); }, [mediaEl]);
  const resume = useCallback(() => {
    mediaEl?.play().then(() => setPlaying(true)).catch(() => {});
  }, [mediaEl]);
  const togglePlay = useCallback(() => {
    const el = mediaEl;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true)).catch(() => {});
    else el.pause();
  }, [mediaEl]);
  const seek = useCallback((t: number) => {
    const el = mediaEl;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, t));
  }, [mediaEl]);

  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const togglePlayer = useCallback(() => setIsPlayerOpen(v => !v), []);
  const logHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => pushHistory(prev, item));
  }, []);

  const togglePip = useCallback(async () => {
    const el = mediaEl;
    if (!el || !pipSupported) return;
    try {
      if (document.pictureInPictureElement === el) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      // user gesture / security — not actionable
    }
  }, [mediaEl, pipSupported]);

  const syncStage = useCallback(() => {
    const el = mediaEl;
    if (!el) return;
    const stack = stagesRef.current;
    const top = stack.length > 0
      ? stack.reduce((best, s) => (s.priority >= best.priority ? s : best), stack[0])
      : null;
    const target = top?.container ?? homeRef.current;
    if (target && el.parentElement !== target) target.appendChild(el);
    if (top) {
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.background = 'black';
      el.style.display = 'block';
      el.controls = top.controls;
    } else {
      el.removeAttribute('style');
      el.controls = false;
    }
  }, [mediaEl]);

  useEffect(() => { syncStage(); }, [syncStage]);

  const attachStage = useCallback((container: HTMLElement | null, opts?: AttachStageOpts) => {
    if (!container) return () => {};
    const entry: StageEntry = {
      container,
      priority: opts?.priority ?? 0,
      controls: opts?.controls ?? false,
    };
    stagesRef.current = [...stagesRef.current, entry];
    syncStage();
    return () => {
      stagesRef.current = stagesRef.current.filter(s => s !== entry);
      syncStage();
    };
  }, [syncStage]);

  // ── Queue rehydration ──
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current) return;
    if (!mediaEl || !resolveItem) return;
    rehydratedRef.current = true;
    const ids = loadJSON<StoredQueueItem[]>(KEYS.queue, []);
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idx = parseInt(loadString(KEYS.queueIndex, '0'), 10);
    const rehydrated: MediaItem[] = ids.flatMap(item => {
      const m = resolveItem(item.kind, item.id);
      return m ? [m] : [];
    });
    if (rehydrated.length === 0) return;
    setQueue(rehydrated);
    const safeIndex = Math.max(0, Math.min(rehydrated.length - 1, Number.isFinite(idx) ? idx : 0));
    setQueueIndex(safeIndex);
    loadMedia(rehydrated[safeIndex]);
  }, [mediaEl, resolveItem, KEYS.queue, KEYS.queueIndex, loadMedia]);

  // ── Media Session API ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!media) {
      try { navigator.mediaSession.metadata = null; } catch {}
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: media.title ?? media.id,
        artist: media.artist ?? appName,
        album: appName,
        artwork: media.artwork ?? [],
      });
    } catch {}
  }, [media, appName]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch {}
    };
    safe('play', () => resume());
    safe('pause', () => pause());
    safe('seekto', (d) => { if (typeof d.seekTime === 'number') seek(d.seekTime); });
    safe('seekbackward', (d) => {
      if (!mediaEl) return;
      seek(mediaEl.currentTime - (d.seekOffset ?? 10));
    });
    safe('seekforward', (d) => {
      if (!mediaEl) return;
      seek(mediaEl.currentTime + (d.seekOffset ?? 10));
    });
    safe('nexttrack', () => next());
    safe('previoustrack', () => prev());
    return () => {
      safe('play', null); safe('pause', null); safe('seekto', null);
      safe('seekbackward', null); safe('seekforward', null);
      safe('nexttrack', null); safe('previoustrack', null);
    };
  }, [mediaEl, resume, pause, seek, next, prev]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = playing ? 'playing' : (media ? 'paused' : 'none'); } catch {}
  }, [playing, media]);

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    if (!enableGlobalShortcuts || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (shouldCaptureKeys && !shouldCaptureKeys()) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!mediaEl || !media) return;
      const skip = (delta: number) => seek(mediaEl.currentTime + delta);
      switch (e.key) {
        case ' ': case 'k': case 'K':
          e.preventDefault();
          if (mediaEl.paused) mediaEl.play().then(() => setPlaying(true)).catch(() => {});
          else mediaEl.pause();
          break;
        case 'ArrowLeft': e.preventDefault(); skip(e.shiftKey ? -10 : -5); break;
        case 'ArrowRight': e.preventDefault(); skip(e.shiftKey ? 10 : 5); break;
        case 'j': case 'J': e.preventDefault(); skip(-10); break;
        case 'l': case 'L': e.preventDefault(); skip(10); break;
        case 'm': case 'M':
          e.preventDefault();
          setVolumeState(v => (v > 0 ? 0 : 0.8));
          break;
        case 'n': case 'N': e.preventDefault(); next(); break;
        case 'p': case 'P': e.preventDefault(); prev(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enableGlobalShortcuts, shouldCaptureKeys, mediaEl, media, seek, next, prev]);

  return (
    <PlayerContext.Provider value={{
      media, playing, currentTime, duration, volume,
      isPlayerOpen, isPip, pipSupported, loadError, history,
      queue, queueIndex, shuffle, repeat,
      playMedia, loadMedia, insertNext, addToQueue, next, prev, toggleShuffle, cycleRepeat,
      pause, resume, togglePlay, seek, setVolume,
      openPlayer, togglePlayer, logHistory, togglePip, mediaEl, attachStage,
    }}>
      {children}
      <div ref={homeRef} style={{ display: 'none' }} />
    </PlayerContext.Provider>
  );
}
