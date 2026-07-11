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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTracesJsonRef = useRef('');

  // Poll trace summaries — only when tab is visible
  useEffect(() => {
    const tracesRoute = routes.traces;
    let cancelled = false;
    let inFlight: Promise<void> | null = null;
    let abortController: AbortController | null = null;

    if (!tracesRoute) {
      lastTracesJsonRef.current = '';
      setTraces([]);
      return;
    }

    const fetchList = () => {
      if (inFlight) return inFlight;

      const controller = new AbortController();
      abortController = controller;
      const refresh = (async () => {
        try {
          const res = await fetch(tracesRoute, { signal: controller.signal });
          if (!res.ok || controller.signal.aborted) return;
          const data = await res.json();
          if (cancelled || controller.signal.aborted) return;
          const json = JSON.stringify(data.traces ?? []);
          if (json !== lastTracesJsonRef.current) {
            lastTracesJsonRef.current = json;
            setTraces(data.traces ?? []);
          }
        } catch { /* ignore */ }
      })();

      inFlight = refresh;
      const clearRefresh = () => {
        if (inFlight === refresh) {
          inFlight = null;
          abortController = null;
        }
      };
      void refresh.then(clearRefresh, clearRefresh);
      return refresh;
    };
    const cancelRefresh = () => {
      abortController?.abort();
      abortController = null;
      inFlight = null;
    };
    const start = () => {
      if (document.visibilityState !== 'visible' || pollRef.current) return;
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') void fetchList();
      }, POLL_MS);
    };
    const stop = () => {
      if (!pollRef.current) return;
      clearInterval(pollRef.current);
      pollRef.current = null;
    };
    const onVis = () => {
      if (document.visibilityState !== 'visible') {
        stop();
        cancelRefresh();
        return;
      }
      void fetchList();
      start();
    };

    if (document.visibilityState === 'visible') {
      void fetchList();
      start();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      stop();
      cancelRefresh();
      document.removeEventListener('visibilitychange', onVis);
    };
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
