'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { routeWithQuery, useWorkspaceHostRoutes } from '../../workspace/hostRoutes';
import type { AgentTrace, TraceSummary } from './types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface TraceState {
  traces: TraceSummary[];
  selectedTraceId: string | null;
  selectedTrace: AgentTrace | null;
  selectedStepIndex: number | null;
  setSelectedTraceId: (id: string | null) => void;
  selectStep: (index: number | null) => void;
  loading: boolean;
}

const TraceContext = createContext<TraceState | null>(null);

export function useTrace(): TraceState {
  const ctx = useContext(TraceContext);
  if (!ctx) throw new Error('useTrace must be used inside TraceProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
const POLL_MS = 30_000;

export function TraceProvider({ children }: { children: ReactNode }) {
  const routes = useWorkspaceHostRoutes();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<AgentTrace | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const lastTracesJsonRef = useRef('');

  // Poll trace summaries — only when tab is visible
  useEffect(() => {
    const tracesRoute = routes.traces;
    let cancelled = false;
    const fetchList = async () => {
      if (!tracesRoute) {
        if (!cancelled) setTraces([]);
        return;
      }
      try {
        const res = await fetch(tracesRoute);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const json = JSON.stringify(data.traces ?? []);
          if (json !== lastTracesJsonRef.current) {
            lastTracesJsonRef.current = json;
            setTraces(data.traces ?? []);
          }
        }
      } catch { /* ignore */ }
    };
    const start = () => { pollRef.current = setInterval(fetchList, POLL_MS); };
    const stop = () => clearInterval(pollRef.current);
    const onVis = () => { stop(); if (document.visibilityState === 'visible') { fetchList(); start(); } };
    fetchList();
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [routes.traces]);

  // Fetch full trace when selection changes
  useEffect(() => {
    const tracesRoute = routes.traces;
    if (!selectedTraceId || !tracesRoute) {
      setSelectedTrace(null);
      setSelectedStepIndex(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(routeWithQuery(tracesRoute, { id: selectedTraceId }));
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setSelectedTrace(data.trace ?? null);
          setSelectedStepIndex(null);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [routes.traces, selectedTraceId]);

  const selectStep = useCallback((index: number | null) => {
    setSelectedStepIndex(index);
  }, []);

  const value = useMemo<TraceState>(() => ({
    traces,
    selectedTraceId,
    selectedTrace,
    selectedStepIndex,
    setSelectedTraceId,
    selectStep,
    loading,
  }), [traces, selectedTraceId, selectedTrace, selectedStepIndex, loading, selectStep]);

  return (
    <TraceContext.Provider value={value}>
      {children}
    </TraceContext.Provider>
  );
}
