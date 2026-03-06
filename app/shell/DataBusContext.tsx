'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { HudsonWorkspace, WorkspaceAppConfig, PipeDefinition, AppOutput, AppInput } from '@hudson/sdk';

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
// Context value
// ---------------------------------------------------------------------------
interface DataBusContextValue {
  /** Register an output getter for an app (called by usePortBridge). */
  registerOutput: (appId: string, getter: (portId: string) => unknown | null) => void;
  /** Register an input setter for an app (called by usePortBridge). */
  registerInput: (appId: string, setter: (portId: string, data: unknown) => void) => void;
  /** Push data through a saved pipe by ID. */
  pushPipe: (pipeId: string) => Promise<boolean>;
  /** Ad-hoc push without a saved pipe. */
  pushDirect: (srcAppId: string, srcPortId: string, sinkAppId: string, sinkPortId: string) => boolean;
  /** All saved pipes. */
  pipes: PipeDefinition[];
  /** Create and persist a new pipe. */
  createPipe: (pipe: Omit<PipeDefinition, 'id' | 'createdAt' | 'lastPushedAt'>) => Promise<PipeDefinition | null>;
  /** Delete a saved pipe. */
  deletePipe: (id: string) => Promise<void>;
  /** Get all declared ports across apps (for terminal prompt). */
  getPortCatalog: () => PortCatalogEntry[];
}

const DataBusCtx = createContext<DataBusContextValue | null>(null);

export function useDataBus() {
  const ctx = useContext(DataBusCtx);
  if (!ctx) throw new Error('useDataBus must be inside DataBusProvider');
  return ctx;
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
  // --- Port registries (mutable refs — no re-renders on registration) ---
  const outputGetters = useRef<Map<string, (portId: string) => unknown | null>>(new Map());
  const inputSetters = useRef<Map<string, (portId: string, data: unknown) => void>>(new Map());

  const registerOutput = useCallback((appId: string, getter: (portId: string) => unknown | null) => {
    outputGetters.current.set(appId, getter);
  }, []);

  const registerInput = useCallback((appId: string, setter: (portId: string, data: unknown) => void) => {
    inputSetters.current.set(appId, setter);
  }, []);

  // --- Pipes state (polled from API) ---
  const [pipes, setPipes] = useState<PipeDefinition[]>([]);

  const fetchPipes = useCallback(async () => {
    try {
      const res = await fetch('/api/pipes');
      const data = await res.json();
      setPipes(data.pipes ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPipes();
    const id = setInterval(fetchPipes, 5000);
    return () => clearInterval(id);
  }, [fetchPipes]);

  // --- Push execution ---
  const pushDirect = useCallback((srcAppId: string, srcPortId: string, sinkAppId: string, sinkPortId: string): boolean => {
    const getter = outputGetters.current.get(srcAppId);
    const setter = inputSetters.current.get(sinkAppId);
    if (!getter || !setter) return false;
    const data = getter(srcPortId);
    if (data == null) return false;
    setter(sinkPortId, data);
    return true;
  }, []);

  const pushPipe = useCallback(async (pipeId: string): Promise<boolean> => {
    const pipe = pipes.find(p => p.id === pipeId);
    if (!pipe || !pipe.enabled) return false;
    const ok = pushDirect(pipe.source.appId, pipe.source.portId, pipe.sink.appId, pipe.sink.portId);
    if (ok) {
      // Update lastPushedAt on server
      try {
        await fetch('/api/pipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-pushed', pipe: { id: pipeId } }),
        });
      } catch { /* non-critical */ }
    }
    return ok;
  }, [pipes, pushDirect]);

  // --- CRUD ---
  const createPipe = useCallback(async (partial: Omit<PipeDefinition, 'id' | 'createdAt' | 'lastPushedAt'>): Promise<PipeDefinition | null> => {
    try {
      const res = await fetch('/api/pipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipe: { ...partial, id: crypto.randomUUID().slice(0, 8) } }),
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

  // --- Port catalog (static declarations from workspace apps) ---
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

  const value: DataBusContextValue = {
    registerOutput,
    registerInput,
    pushPipe,
    pushDirect,
    pipes,
    createPipe,
    deletePipe,
    getPortCatalog,
  };

  return <DataBusCtx.Provider value={value}>{children}</DataBusCtx.Provider>;
}

// ---------------------------------------------------------------------------
// usePortBridge — called per-app inside Provider scope (like useAppHooks)
// ---------------------------------------------------------------------------
export function usePortBridge(config: WorkspaceAppConfig) {
  const { app } = config;
  const bus = useDataBus();

  // Always call hooks unconditionally (React rules)
  const getter = app.hooks.usePortOutput?.() ?? null;
  const setter = app.hooks.usePortInput?.() ?? null;

  useEffect(() => {
    if (getter) bus.registerOutput(app.id, getter);
  }, [app.id, getter, bus]);

  useEffect(() => {
    if (setter) bus.registerInput(app.id, setter);
  }, [app.id, setter, bus]);
}
