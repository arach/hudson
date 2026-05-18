'use client';

import { useCallback } from 'react';
import { DAY_STACK_AGENT_GUIDE, DAY_STACK_PLAN_FORMAT } from './agent-context';
import { useDayStack } from './DayStackProvider';

function asText(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data === null || data === undefined) return null;
  return JSON.stringify(data, null, 2);
}

export function useDayStackPortOutput() {
  const { source, blocks, activeBlock } = useDayStack();

  return useCallback((portId: string): unknown | null => {
    if (portId === 'plan-markdown') return source;
    if (portId === 'blocks') return blocks;
    if (portId === 'active-block') return activeBlock;
    if (portId === 'agent-guide') {
      return `${DAY_STACK_AGENT_GUIDE}\n\nExample:\n${DAY_STACK_PLAN_FORMAT}`;
    }
    return null;
  }, [activeBlock, blocks, source]);
}

export function useDayStackPortInput() {
  const { setSource, appendIntake } = useDayStack();

  return useCallback((portId: string, data: unknown) => {
    const text = asText(data);
    if (!text) return;

    if (portId === 'plan-markdown') {
      setSource(text);
      return;
    }

    if (portId === 'intake-text') {
      appendIntake(text);
    }
  }, [appendIntake, setSource]);
}
