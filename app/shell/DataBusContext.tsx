'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { createHudsonId, type HudsonWorkspace, type WorkspaceAppConfig, type PipeDefinition, type AppOutput, type AppInput } from 'hudsonkit';
import { useEventSourceInvalidation } from '../hooks/useEventSourceInvalidation';

const PIPE_FALLBACK_POLL_MS = 300_000;

// ---------------------------------------------------------------------------
// Port catalog entry (for terminal / UI)
// ---------------------------------------------------------------------------
export interface PortCatalogEntry {
  appId: string;
  appName: string;
  outputs: AppOutput[];
  inputs: AppInput[];
}

// ---------------------------------------------------------------------------
// Port activity log entry
// ---------------------------------------------------------------------------
export interface PortActivityEntry {
  id: number;
  timestamp: number;
  direction: 'push' | 'receive';
  appId: string;
  portId: string;
  peerAppId: string;
  peerPortId: string;
  pipeName?: string;
  /** Preview of the data — truncated string representation */
  dataPreview: string;
  /** Data type hint */
  dataType: string;
  /** Byte size estimate */
  dataSize: number;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------
interface DataBusContextValue {
  registerOutput: (appId: string, getter: (portId: string) => unknown | null) => void;
  registerInput: (appId: string, setter: (portId: string, data: unknown) => void) => void;
  pushPipe: (pipeId: string) => Promise<boolean>;
  pushDirect: (srcAppId: string, srcPortId: string, sinkAppId: string, sinkPortId: string) => boolean;
  pipes: PipeDefinition[];
  createPipe: (pipe: Omit<PipeDefinition, 'id' | 'createdAt' | 'lastPushedAt'>) => Promise<PipeDefinition | null>;
  deletePipe: (id: string) => Promise<void>;
  getPortCatalog: () => PortCatalogEntry[];
  /** Activity log — all push/receive events across apps */
  portActivity: PortActivityEntry[];
  /** Activity for a specific app */
  getAppActivity: (appId: string) => PortActivityEntry[];
}

const DataBusCtx = createContext<DataBusContextValue | null>(null);

export function useDataBus() {
  const ctx = useContext(DataBusCtx);
  if (!ctx) throw new Error('useDataBus must be inside DataBusProvider');
  return ctx;
}

export function useOptionalDataBus() {
  return useContext(DataBusCtx);
}

/** Get activity log entries for a specific app (push or receive). */
export function usePortActivity(appId: string): PortActivityEntry[] {
  const { portActivity } = useDataBus();
  return useMemo(() => portActivity.filter(e => e.appId === appId), [portActivity, appId]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _activitySeq = 0;

function summarizeData(data: unknown): { dataPreview: string; dataType: string; dataSize: number } {
  if (data == null) return { dataPreview: 'null', dataType: 'null', dataSize: 0 };
  if (typeof data === 'string') {
    const isDataUrl = data.startsWith('data:');
    const isSvg = data.includes('<svg');
    const dataType = isDataUrl ? 'image (data URL)' : isSvg ? 'svg' : 'string';
    const preview = isDataUrl
      ? `data:${data.slice(5, 30)}... (${data.length} chars)`
      : data.length > 120 ? data.slice(0, 120) + '...' : data;
    return { dataPreview: preview, dataType, dataSize: data.length };
  }
  if (typeof data === 'object') {
    const json = JSON.stringify(data);
    return {
      dataPreview: json.length > 120 ? json.slice(0, 120) + '...' : json,
      dataType: 'json',
      dataSize: json.length,
    };
  }
  return { dataPreview: String(data), dataType: typeof data, dataSize: String(data).length };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function DataBusProvider({
  workspace,
  children,
}: {
  workspace: HudsonWorkspace;
  children: ReactNode;
}) {
  const outputGetters = useRef<Map<string, (portId: string) => unknown | null>>(new Map());
  const inputSetters = useRef<Map<string, (portId: string, data: unknown) => void>>(new Map());
  const [portActivity, setPortActivity] = useState<PortActivityEntry[]>([]);

  const logActivity = useCallback((entry: Omit<PortActivityEntry, 'id' | 'timestamp'>) => {
    setPortActivity(prev => [
      { ...entry, id: ++_activitySeq, timestamp: Date.now() },
      ...prev,
    ].slice(0, 50)); // Keep last 50 entries
  }, []);

  const registerOutput = useCallback((appId: string, getter: (portId: string) => unknown | null) => {
    outputGetters.current.set(appId, getter);
  }, []);

  const registerInput = useCallback((appId: string, setter: (portId: string, data: unknown) => void) => {
    inputSetters.current.set(appId, setter);
  }, []);

  // --- Pipes state ---
  const [pipes, setPipes] = useState<PipeDefinition[]>([]);
  const lastPipesJsonRef = useRef('');

  const fetchPipes = useCallback(async () => {
    try {
      const res = await fetch('/api/pipes');
      const data = await res.json();
      const json = JSON.stringify(data.pipes ?? []);
      if (json !== lastPipesJsonRef.current) {
        lastPipesJsonRef.current = json;
        setPipes(data.pipes ?? []);
      }
    } catch { /* silent */ }
  }, []);

  useEventSourceInvalidation({
    url: '/api/pipes/stream',
    onInvalidate: fetchPipes,
    fallbackIntervalMs: PIPE_FALLBACK_POLL_MS,
  });

  // --- Push execution with logging ---
  const pushDirect = useCallback((srcAppId: string, srcPortId: string, sinkAppId: string, sinkPortId: string, pipeName?: string): boolean => {
    const getter = outputGetters.current.get(srcAppId);
    const setter = inputSetters.current.get(sinkAppId);
    if (!getter || !setter) {
      logActivity({
        direction: 'push', appId: srcAppId, portId: srcPortId,
        peerAppId: sinkAppId, peerPortId: sinkPortId, pipeName,
        dataPreview: getter ? 'No input handler registered' : 'No output handler registered',
        dataType: 'error', dataSize: 0, success: false,
      });
      return false;
    }
    const data = getter(srcPortId);
    if (data == null) {
      logActivity({
        direction: 'push', appId: srcAppId, portId: srcPortId,
        peerAppId: sinkAppId, peerPortId: sinkPortId, pipeName,
        dataPreview: 'Output returned null', dataType: 'null', dataSize: 0, success: false,
      });
      return false;
    }

    const summary = summarizeData(data);

    // Log push from source
    logActivity({
      direction: 'push', appId: srcAppId, portId: srcPortId,
      peerAppId: sinkAppId, peerPortId: sinkPortId, pipeName,
      ...summary, success: true,
    });

    // Execute transfer
    setter(sinkPortId, data);

    // Log receive at sink
    logActivity({
      direction: 'receive', appId: sinkAppId, portId: sinkPortId,
      peerAppId: srcAppId, peerPortId: srcPortId, pipeName,
      ...summary, success: true,
    });

    return true;
  }, [logActivity]);

  const pushPipe = useCallback(async (pipeId: string): Promise<boolean> => {
    const pipe = pipes.find(p => p.id === pipeId);
    if (!pipe || !pipe.enabled) return false;
    const ok = pushDirect(pipe.source.appId, pipe.source.portId, pipe.sink.appId, pipe.sink.portId, pipe.name);
    if (ok) {
      try {
        await fetch('/api/pipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-pushed', pipe: { id: pipeId } }),
        });
        await fetchPipes();
      } catch { /* non-critical */ }
    }
    return ok;
  }, [pipes, pushDirect, fetchPipes]);

  // --- CRUD ---
  const createPipe = useCallback(async (partial: Omit<PipeDefinition, 'id' | 'createdAt' | 'lastPushedAt'>): Promise<PipeDefinition | null> => {
    try {
      const res = await fetch('/api/pipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipe: { ...partial, id: createHudsonId('', 8) } }),
      });
      const data = await res.json();
      if (data.pipe) {
        await fetchPipes();
        return data.pipe;
      }
      return null;
    } catch {
      return null;
    }
  }, [fetchPipes]);

  const deletePipe = useCallback(async (id: string) => {
    try {
      await fetch('/api/pipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', pipe: { id } }),
      });
      await fetchPipes();
    } catch { /* silent */ }
  }, [fetchPipes]);

  // --- Port catalog ---
  const getPortCatalog = useCallback((): PortCatalogEntry[] => {
    return workspace.apps
      .filter((c: WorkspaceAppConfig) => c.app.ports)
      .map((c: WorkspaceAppConfig) => ({
        appId: c.app.id,
        appName: c.app.name,
        outputs: c.app.ports?.outputs ?? [],
        inputs: c.app.ports?.inputs ?? [],
      }));
  }, [workspace]);

  const getAppActivity = useCallback((appId: string) => {
    return portActivity.filter(e => e.appId === appId);
  }, [portActivity]);

  const value = useMemo<DataBusContextValue>(() => ({
    registerOutput,
    registerInput,
    pushPipe,
    pushDirect,
    pipes,
    createPipe,
    deletePipe,
    getPortCatalog,
    portActivity,
    getAppActivity,
  }), [
    registerOutput, registerInput, pushPipe, pushDirect,
    pipes, createPipe, deletePipe, getPortCatalog,
    portActivity, getAppActivity,
  ]);

  return <DataBusCtx.Provider value={value}>{children}</DataBusCtx.Provider>;
}

// ---------------------------------------------------------------------------
// usePortBridge — called per-app inside Provider scope (like useAppHooks)
// ---------------------------------------------------------------------------
export function usePortBridge(config: WorkspaceAppConfig) {
  const { app } = config;
  const bus = useDataBus();

  const getter = app.hooks.usePortOutput?.() ?? null;
  const setter = app.hooks.usePortInput?.() ?? null;

  useEffect(() => {
    if (getter) bus.registerOutput(app.id, getter);
  }, [app.id, getter, bus]);

  useEffect(() => {
    if (setter) bus.registerInput(app.id, setter);
  }, [app.id, setter, bus]);
}
