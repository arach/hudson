'use client';

import { useCallback } from 'react';
import { useOpenScout } from './OpenScoutProvider';

export function useOpenScoutPortOutput() {
  const {
    filteredAgents,
    filteredChannel,
    selectedAgentRecord,
    selectedAgent,
    searchQuery,
    activityFilter,
  } = useOpenScout();

  return useCallback((portId: string): unknown | null => {
    if (portId === 'agents') {
      return filteredAgents;
    }
    if (portId === 'channel') {
      return filteredChannel;
    }
    if (portId === 'selected-agent') {
      return selectedAgentRecord ?? null;
    }
    if (portId === 'scope') {
      return {
        selectedAgent,
        searchQuery,
        activityFilter,
      };
    }
    return null;
  }, [
    activityFilter,
    filteredAgents,
    filteredChannel,
    searchQuery,
    selectedAgent,
    selectedAgentRecord,
  ]);
}
