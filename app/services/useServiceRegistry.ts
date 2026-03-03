'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePersistentState, usePlatform } from '@hudson/sdk';
import type { ServiceRecord, ServiceAction, ServiceStatus } from '@hudson/sdk';
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

  const checkHealth = useCallback(
    async (serviceId: string) => {
      const svc = SERVICE_CATALOG.find((s) => s.id === serviceId);
      if (!svc?.check.healthUrl) return;

      try {
        const res = await fetch(svc.check.healthUrl, { signal: AbortSignal.timeout(2000) });
        const status: ServiceStatus = res.ok ? 'running' : 'not_installed';
        updateRecord(serviceId, { status });
      } catch {
        updateRecord(serviceId, { status: 'not_installed' });
      }
    },
    [updateRecord],
  );

  const checkAll = useCallback(async () => {
    await Promise.all(SERVICE_CATALOG.map((svc) => checkHealth(svc.id)));
  }, [checkHealth]);

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

  // Initial health check + polling
  useEffect(() => {
    checkAll();
    pollRef.current = setInterval(checkAll, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkAll]);

  return {
    catalog: SERVICE_CATALOG,
    records,
    history,
    checkHealth,
    checkAll,
    executeAction,
  };
}
