'use client';

import { useEffect, useState } from 'react';
import type { HObservation } from '../../observability';
import { useWorkspaceHostRoutes } from '../hostRoutes';

export interface UseAgentActionLogOptions {
  limit?: number;
  /** Re-fetch every N ms while mounted. Omit to fetch once on mount. */
  refreshMs?: number;
  /** Set false to skip the fetch entirely (e.g. when the panel is hidden). */
  enabled?: boolean;
  /** Host route override. Defaults to WorkspaceShell environment routes. */
  endpoint?: string;
}

export function useAgentActionLog({
  limit = 200,
  refreshMs,
  enabled = true,
  endpoint,
}: UseAgentActionLogOptions = {}): readonly HObservation[] {
  const routes = useWorkspaceHostRoutes();
  const resolvedEndpoint = endpoint ?? routes.agentActions;
  const [events, setEvents] = useState<readonly HObservation[]>([]);

  useEffect(() => {
    if (!enabled || !resolvedEndpoint) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${resolvedEndpoint}?limit=${limit}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { events?: HObservation[] };
        if (!cancelled && Array.isArray(payload.events)) {
          setEvents(payload.events);
        }
      } catch {
        // Tolerate transient failures — table just stays on its current snapshot.
      }
    };

    void load();
    if (!refreshMs || refreshMs <= 0) {
      return () => { cancelled = true; };
    }
    const interval = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, limit, refreshMs, resolvedEndpoint]);

  return events;
}
