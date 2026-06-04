'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import Canvas from './canvas/Canvas';
import AppWindow from './windows/AppWindow';
import { InstanceProvider } from '../context/InstanceContext';
import type { HudsonApp } from '../types/app';
import type { WorkspaceAppConfig } from '../types/workspace';

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FALLBACK_BOUNDS: Bounds = { x: -240, y: -320, w: 480, h: 640 };

type AppEntry = WorkspaceAppConfig | HudsonApp;

function isWorkspaceAppConfig(entry: AppEntry): entry is WorkspaceAppConfig {
  return typeof entry === 'object'
    && entry !== null
    && 'app' in entry
    && typeof (entry as WorkspaceAppConfig).app?.id === 'string';
}

function normalize(entry: AppEntry): WorkspaceAppConfig {
  if (isWorkspaceAppConfig(entry)) return entry;
  return { app: entry, canvasMode: 'windowed' };
}

function readBounds(key: string): Bounds | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && typeof parsed.x === 'number'
      && typeof parsed.y === 'number'
      && typeof parsed.w === 'number'
      && typeof parsed.h === 'number'
    ) {
      return parsed as Bounds;
    }
  } catch {}
  return undefined;
}

function writeBounds(key: string, bounds: Bounds) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(bounds));
  } catch {}
}

export interface EmbedShellProps {
  /** Apps to render as floating windows. Accepts `WorkspaceAppConfig` (e.g. from
   *  `createEmbedApp`) or raw `HudsonApp` objects; raw apps get `FALLBACK_BOUNDS`
   *  unless `defaultBounds` is supplied. */
  apps: AppEntry[];
  /** Initial canvas zoom. Default 1. */
  defaultScale?: number;
  /** Render the canvas grid background. Default true. */
  showGrid?: boolean;
  /** Storage key prefix for per-app window bounds. Omit to disable persistence. */
  storageKey?: string;
  /** Fallback bounds for apps that didn't declare `defaultWindowBounds`. */
  defaultBounds?: Bounds;
  /** When provided, rendered above the canvas (e.g. a thin header). */
  header?: ReactNode;
}

/**
 * Minimal multi-app shell — renders each `HudsonApp` as a draggable, resizable
 * window on a pan/zoom canvas. Designed for passive embeds created via
 * `createEmbedApp`.
 *
 * What this shell intentionally omits, compared to Hudson's host shell:
 *   - navigation bar, side panels, status bar, command palette, terminal,
 *     inspector, ports, AI runtime, intent catalog, services, boot splash,
 *     workspace switcher.
 *
 * If you need any of that, build a custom shell out of `hudsonkit/shell`
 * (Frame + Canvas + AppWindow + chrome primitives) instead.
 */
export function EmbedShell({
  apps,
  defaultScale = 1,
  showGrid = true,
  storageKey,
  defaultBounds,
  header,
}: EmbedShellProps) {
  const configs = useMemo(() => apps.map(normalize), [apps]);

  // --- Pan & zoom (in-memory; this shell does not persist viewport state) ---
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale] = useState(defaultScale);
  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setPanOffset(prev => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
  }, []);

  // --- Window bounds (initialised once from defaults / storage) ---
  const boundsInit = useRef<Record<string, Bounds> | null>(null);
  if (boundsInit.current === null) {
    const seed: Record<string, Bounds> = {};
    for (const c of configs) {
      const fallback = c.defaultWindowBounds ?? defaultBounds ?? FALLBACK_BOUNDS;
      const stored = storageKey ? readBounds(`${storageKey}.${c.app.id}`) : undefined;
      seed[c.app.id] = stored ?? fallback;
    }
    boundsInit.current = seed;
  }
  const [boundsMap, setBoundsMap] = useState<Record<string, Bounds>>(boundsInit.current);
  const setBoundsFor = useCallback((appId: string, bounds: Bounds) => {
    setBoundsMap(prev => ({ ...prev, [appId]: bounds }));
    if (storageKey) writeBounds(`${storageKey}.${appId}`, bounds);
  }, [storageKey]);

  // --- Focus + z-order ---
  const [focusedId, setFocusedId] = useState(configs[0]?.app.id ?? '');
  const zCounterRef = useRef(0);
  const [zMap, setZMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of configs) {
      zCounterRef.current += 1;
      map[c.app.id] = zCounterRef.current;
    }
    return map;
  });
  const focusApp = useCallback((appId: string) => {
    setFocusedId(appId);
    zCounterRef.current += 1;
    setZMap(prev => ({ ...prev, [appId]: zCounterRef.current }));
  }, []);

  // --- Nest all Providers so each app's hooks can be called inside its scope.
  // For createEmbedApp this is a Fragment passthrough; for custom HudsonApps
  // with real Providers it keeps the tree stable across re-renders. ---
  let tree: ReactNode = (
    <EmbedShellWorld
      configs={configs}
      boundsMap={boundsMap}
      onBoundsChange={setBoundsFor}
      zMap={zMap}
      focusedId={focusedId}
      onFocus={focusApp}
      panOffset={panOffset}
      scale={scale}
      onPan={handlePan}
      showGrid={showGrid}
      header={header}
    />
  );

  for (let i = configs.length - 1; i >= 0; i--) {
    const { app } = configs[i];
    const Provider = app.Provider;
    tree = (
      <Provider visible focused={app.id === focusedId}>
        {tree}
      </Provider>
    );
  }

  return <>{tree}</>;
}

interface WorldProps {
  configs: WorkspaceAppConfig[];
  boundsMap: Record<string, Bounds>;
  onBoundsChange: (appId: string, bounds: Bounds) => void;
  zMap: Record<string, number>;
  focusedId: string;
  onFocus: (appId: string) => void;
  panOffset: { x: number; y: number };
  scale: number;
  onPan: (delta: { x: number; y: number }) => void;
  showGrid: boolean;
  header?: ReactNode;
}

function EmbedShellWorld({
  configs,
  boundsMap,
  onBoundsChange,
  zMap,
  focusedId,
  onFocus,
  panOffset,
  scale,
  onPan,
  showGrid,
  header,
}: WorldProps) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-background">
      <Canvas
        panOffset={panOffset}
        scale={scale}
        onPan={onPan}
        gridOpacity={showGrid ? 1 : 0}
      />

      {/* World layer — translated by pan, with a centred, scaled inner origin */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate3d(${panOffset.x * scale}px, ${panOffset.y * scale}px, 0)`,
        }}
      >
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {configs.map(c => (
            <div
              key={c.app.id}
              style={{ position: 'absolute', zIndex: zMap[c.app.id] ?? 1 }}
            >
              <InstanceProvider instanceId={c.app.id} appId={c.app.id}>
                <AppWindow
                  title={c.app.name}
                  bounds={boundsMap[c.app.id]}
                  onBoundsChange={(b) => onBoundsChange(c.app.id, b)}
                  isFocused={c.app.id === focusedId}
                  onFocus={() => onFocus(c.app.id)}
                  worldScale={scale}
                >
                  <c.app.slots.Content />
                </AppWindow>
              </InstanceProvider>
            </div>
          ))}
        </div>
      </div>

      {header ? (
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-auto">
          {header}
        </div>
      ) : null}
    </div>
  );
}
