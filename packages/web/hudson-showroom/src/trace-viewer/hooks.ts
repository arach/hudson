'use client';

import { useMemo } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useTrace } from './TraceProvider';

// ---------------------------------------------------------------------------
// useCommands
// ---------------------------------------------------------------------------
export function useTraceCommands(): CommandOption[] {
  const { traces, setSelectedTraceId, selectStep } = useTrace();

  return useMemo<CommandOption[]>(() => [
    ...traces.map((t) => ({
      id: `trace:select:${t.id}`,
      label: `Open trace: ${t.name}`,
      action: () => { setSelectedTraceId(t.id); selectStep(null); },
    })),
    {
      id: 'trace:deselect',
      label: 'Close current trace',
      action: () => { setSelectedTraceId(null); },
    },
  ], [traces, setSelectedTraceId, selectStep]);
}

// ---------------------------------------------------------------------------
// useStatus
// ---------------------------------------------------------------------------
export function useTraceStatus(): { label: string; color: StatusColor } {
  const { selectedTrace, traces, loading } = useTrace();
  if (loading) return { label: 'LOADING', color: 'amber' };
  if (selectedTrace?.status === 'running') return { label: 'RUNNING', color: 'amber' };
  if (selectedTrace?.status === 'failed') return { label: 'FAILED', color: 'red' };
  if (selectedTrace) return { label: 'VIEWING', color: 'emerald' };
  return { label: `${traces.length} TRACES`, color: 'neutral' };
}
