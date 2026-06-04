import { useCallback } from 'react';
import { useTrace } from './TraceProvider';

/**
 * Port output hook for Trace Viewer.
 * - 'selected-trace': full AgentTrace object of the selected run
 * - 'step-output': output of the currently selected step
 */
export function useTracePortOutput() {
  const { selectedTrace, selectedStepIndex } = useTrace();

  return useCallback((portId: string): unknown | null => {
    if (portId === 'selected-trace') {
      return selectedTrace ?? null;
    }
    if (portId === 'step-output') {
      if (!selectedTrace || selectedStepIndex === null) return null;
      const step = selectedTrace.steps[selectedStepIndex];
      return step?.output ?? null;
    }
    return null;
  }, [selectedTrace, selectedStepIndex]);
}
