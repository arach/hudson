'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePersistentState } from 'hudsonkit';
import type { RuntimeCompanionPhase, RuntimeCompanionStatus, RuntimeNodeSummary } from './types';

const FOCUSED_POLL_MS = 5_000;
const VISIBLE_POLL_MS = 15_000;

interface RuntimeState {
  phase: RuntimeCompanionPhase;
  status: RuntimeCompanionStatus | null;
  error: string | null;
  profileId: string;
  setProfileId: (profileId: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  selectedNode: RuntimeNodeSummary | null;
  nodes: RuntimeNodeSummary[];
  filteredNodes: RuntimeNodeSummary[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refresh: () => Promise<void>;
  sendAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  launchCompanion: () => Promise<void>;
  launching: boolean;
}

const RuntimeContext = createContext<RuntimeState | null>(null);

export function useRuntime() {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used inside RuntimeProvider');
  return ctx;
}

async function fetchStatus(profileId: string): Promise<RuntimeCompanionStatus> {
  const res = await fetch(`/api/runtime/status?profileId=${encodeURIComponent(profileId)}`, {
    signal: AbortSignal.timeout(6_000),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Status probe failed (${res.status})`);
  }
  return data.status as RuntimeCompanionStatus;
}

async function postControl(
  action: string,
  profileId: string,
  payload?: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch('/api/runtime/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, profileId, payload }),
    signal: AbortSignal.timeout(8_000),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? data.response?.message ?? `Control command failed (${res.status})`);
  }
  return true;
}

export function RuntimeProvider({
  children,
  disabled = false,
  visible = true,
  focused = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  visible?: boolean;
  focused?: boolean;
}) {
  const [profileId, setProfileId] = usePersistentState('runtime.profileId', 'hudson-default');
  const [phase, setPhase] = useState<RuntimeCompanionPhase>('checking');
  const [status, setStatus] = useState<RuntimeCompanionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [launching, setLaunching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (disabled) return;
    setPhase('checking');
    try {
      const next = await fetchStatus(profileId);
      setStatus(next);
      setError(null);
      setPhase(next.online ? 'online' : 'offline');
      if (next.selectedNodeIDs?.length === 1) {
        setSelectedNodeId(next.selectedNodeIDs[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to probe Runtime companion.');
      setPhase('offline');
    }
  }, [disabled, profileId]);

  const sendAction = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    try {
      await postControl(action, profileId, payload);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Runtime control command failed.');
      return false;
    }
  }, [profileId, refresh]);

  const launchCompanion = useCallback(async () => {
    setLaunching(true);
    try {
      const res = await fetch('/api/services/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'runtime-companion', action: 'start', triggeredBy: 'user' }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? data.output ?? 'Failed to launch Runtime companion.');
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch Runtime companion.');
    } finally {
      setLaunching(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (disabled || !visible) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    void refresh();
    const interval = focused ? FOCUSED_POLL_MS : VISIBLE_POLL_MS;
    pollRef.current = setInterval(() => { void refresh(); }, interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [disabled, visible, focused, refresh]);

  const nodes = useMemo(() => status?.nodes ?? [], [status?.nodes]);
  const filteredNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return nodes;
    return nodes.filter(node =>
      node.id.toLowerCase().includes(query)
      || (node.title ?? '').toLowerCase().includes(query)
      || (node.subtitle ?? '').toLowerCase().includes(query)
      || (node.tag ?? '').toLowerCase().includes(query),
    );
  }, [nodes, searchQuery]);
  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const value = useMemo<RuntimeState>(() => ({
    phase,
    status,
    error,
    profileId,
    setProfileId,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    nodes,
    filteredNodes,
    searchQuery,
    setSearchQuery,
    refresh,
    sendAction,
    launchCompanion,
    launching,
  }), [
    phase,
    status,
    error,
    profileId,
    setProfileId,
    selectedNodeId,
    selectedNode,
    nodes,
    filteredNodes,
    searchQuery,
    refresh,
    sendAction,
    launchCompanion,
    launching,
  ]);

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
