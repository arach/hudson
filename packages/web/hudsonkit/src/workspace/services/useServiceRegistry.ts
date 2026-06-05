'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { usePlatform } from '../../platform';
import type { ServiceRecord, ServiceAction, ServiceStatus } from '../../index';
import { SERVICE_CATALOG } from './catalog';

const POLL_INTERVAL = 30_000;
const MAX_HISTORY = 200;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useServiceRegistry() {
  const { serviceApiUrl } = usePlatform();
  const [records, setRecords] = usePersistentState<Record<string, ServiceRecord>>(
    'hudson.services',
    {},
  );
  const [history, setHistory] = usePersistentState<ServiceAction[]>(
    'hudson.services.history',
    [],
  );
  const [autoStartIds, setAutoStartIds] = usePersistentState<string[]>(
    'hudson.services.autoStart',
    [],
  );
  // Track which services we auto-started this session so we can stop them on quit
  const autoStartedRef = useRef<Set<string>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateRecord = useCallback(
    (sid: string, patch: Partial<ServiceRecord>) => {
      setRecords((prev) => {
        const existing = prev[sid];
        const statusChanged = patch.status != null && patch.status !== existing?.status;
        const now = Date.now();
        const base: ServiceRecord = {
          serviceId: sid,
          status: 'unknown',
          lastChecked: now,
          lastChanged: now,
        };
        // Clear stale error when status moves away from 'error'
        const clearError =
          patch.status != null && patch.status !== 'error' && !('error' in patch);
        return {
          ...prev,
          [sid]: {
            ...base,
            ...existing,
            ...patch,
            ...(clearError ? { error: undefined } : {}),
            lastChecked: now,
            ...(statusChanged ? { lastChanged: now } : {}),
          },
        };
      });
    },
    [setRecords],
  );

  const appendHistory = useCallback(
    (entry: ServiceAction) => {
      setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
    },
    [setHistory],
  );

  const fetchServiceStatuses = useCallback(async () => {
    const res = await fetch(`${serviceApiUrl}/api/services`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      throw new Error(`Service status request failed (${res.status})`);
    }
    return res.json() as Promise<Array<{ id: string; status: ServiceStatus }>>;
  }, [serviceApiUrl]);

  const checkHealth = useCallback(
    async (serviceId: string) => {
      const svc = SERVICE_CATALOG.find((s) => s.id === serviceId);
      if (!svc?.check.healthUrl) return;

      try {
        const statuses = await fetchServiceStatuses();
        const status = statuses.find((entry) => entry.id === serviceId)?.status ?? 'unknown';
        updateRecord(serviceId, { status });
      } catch {
        updateRecord(serviceId, { status: 'error', error: 'Failed to refresh service status.' });
      }
    },
    [fetchServiceStatuses, updateRecord],
  );

  const checkAll = useCallback(async () => {
    try {
      const statuses = await fetchServiceStatuses();
      for (const svc of SERVICE_CATALOG) {
        const status = statuses.find((entry) => entry.id === svc.id)?.status ?? 'unknown';
        updateRecord(svc.id, { status });
      }
    } catch {
      for (const svc of SERVICE_CATALOG) {
        updateRecord(svc.id, { status: 'error', error: 'Failed to refresh service status.' });
      }
    }
  }, [fetchServiceStatuses, updateRecord]);

  const executeAction = useCallback(
    async (
      serviceId: string,
      action: 'check' | 'install' | 'start' | 'stop',
      triggeredBy: 'user' | 'agent' | 'system' = 'user',
    ) => {
      const startTime = Date.now();

      try {
        const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId, action, triggeredBy }),
        });

        const text = await res.text();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Invalid response (HTTP ${res.status}): ${text.slice(0, 200) || '(empty)'}`);
        }

        updateRecord(serviceId, {
          status: data.status ?? 'unknown',
          pid: data.pid,
          logFile: data.logFile,
          error: data.error,
        });

        const entry: ServiceAction = {
          id: makeId(),
          serviceId,
          action,
          triggeredBy,
          timestamp: startTime,
          command: data.command,
          output: data.output ?? data.error,
          exitCode: data.exitCode ?? null,
          success: data.success,
          durationMs: data.durationMs ?? Date.now() - startTime,
        };

        appendHistory(entry);
        return entry;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateRecord(serviceId, { status: 'error', error: message });

        const entry: ServiceAction = {
          id: makeId(),
          serviceId,
          action,
          triggeredBy,
          timestamp: startTime,
          output: message,
          exitCode: null,
          success: false,
          durationMs: Date.now() - startTime,
        };

        appendHistory(entry);
        return entry;
      }
    },
    [serviceApiUrl, updateRecord, appendHistory],
  );

  const toggleAutoStart = useCallback(
    (serviceId: string) => {
      setAutoStartIds((prev) => {
        const set = new Set(prev);
        if (set.has(serviceId)) {
          set.delete(serviceId);
        } else {
          set.add(serviceId);
        }
        return [...set];
      });
    },
    [setAutoStartIds],
  );

  // Initial health check + polling (paused when tab hidden)
  useEffect(() => {
    checkAll();
    const start = () => { pollRef.current = setInterval(checkAll, POLL_INTERVAL); };
    const stop = () => { if (pollRef.current) clearInterval(pollRef.current); };
    const onVis = () => { stop(); if (document.visibilityState === 'visible') { checkAll(); start(); } };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [checkAll]);

  // Auto-start services after initial health check
  const autoStartDone = useRef(false);
  useEffect(() => {
    if (autoStartDone.current || autoStartIds.length === 0) return;
    autoStartDone.current = true;

    // Small delay to let the initial checkAll complete
    const timer = setTimeout(async () => {
      for (const sid of autoStartIds) {
        const svc = SERVICE_CATALOG.find((s) => s.id === sid);
        if (!svc) continue;

        // Check health first
        const statuses = await fetchServiceStatuses().catch(() => []);
        const alive = statuses.find((entry) => entry.id === sid)?.status === 'running';

        if (!alive) {
          console.log(`[services] Auto-starting ${sid}`);
          await executeAction(sid, 'start', 'system');
          autoStartedRef.current.add(sid);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartIds, executeAction, fetchServiceStatuses]);

  // Stop auto-started services on page unload (app quit)
  useEffect(() => {
    const handleUnload = () => {
      for (const sid of autoStartedRef.current) {
        // Fire-and-forget stop via sendBeacon (fetch may be cancelled during unload)
        const blob = new Blob(
          [JSON.stringify({ serviceId: sid, action: 'stop', triggeredBy: 'system' })],
          { type: 'application/json' },
        );
        navigator.sendBeacon(`${serviceApiUrl}/api/services/execute`, blob);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [serviceApiUrl]);

  return {
    catalog: SERVICE_CATALOG,
    records,
    history,
    autoStartIds,
    checkHealth,
    checkAll,
    executeAction,
    toggleAutoStart,
  };
}
