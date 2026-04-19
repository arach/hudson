'use client';

import { useMemo } from 'react';
import type { CommandOption, SearchConfig, StatusColor } from '@hudson/sdk';
import { useOpenScout } from './OpenScoutProvider';

export function useOpenScoutCommands(): CommandOption[] {
  const {
    agents,
    refresh,
    selectedAgent,
    setSelectedAgent,
    searchQuery,
    setSearchQuery,
    activityFilter,
    setActivityFilter,
  } = useOpenScout();

  return useMemo<CommandOption[]>(() => [
    {
      id: 'openscout:refresh',
      label: 'Refresh OpenScout',
      action: () => void refresh(),
      section: 'OpenScout',
    },
    {
      id: 'openscout:show-all',
      label: 'Show All Scout Activity',
      action: () => {
        setSelectedAgent(null);
        setActivityFilter('all');
        setSearchQuery('');
      },
      section: 'OpenScout',
    },
    {
      id: 'openscout:filter:all',
      label: 'Scout Filter: All Activity',
      action: () => setActivityFilter('all'),
      section: 'OpenScout',
    },
    {
      id: 'openscout:filter:ask',
      label: 'Scout Filter: Asks',
      action: () => setActivityFilter('ask'),
      section: 'OpenScout',
    },
    {
      id: 'openscout:filter:reply',
      label: 'Scout Filter: Replies',
      action: () => setActivityFilter('reply'),
      section: 'OpenScout',
    },
    {
      id: 'openscout:filter:speak',
      label: 'Scout Filter: Voice',
      action: () => setActivityFilter('speak'),
      section: 'OpenScout',
    },
    {
      id: 'openscout:filter:system',
      label: 'Scout Filter: System',
      action: () => setActivityFilter('system'),
      section: 'OpenScout',
    },
    ...(selectedAgent || searchQuery || activityFilter !== 'all'
      ? [{
          id: 'openscout:reset-scope',
          label: 'Reset Scout Filters',
          action: () => {
            setSelectedAgent(null);
            setActivityFilter('all');
            setSearchQuery('');
          },
          section: 'OpenScout',
        }]
      : []),
    ...agents.map(agent => ({
      id: `openscout:agent:${agent.name}`,
      label: `Focus Scout Agent: ${agent.name}`,
      action: () => setSelectedAgent(agent.name),
      section: 'Agents',
    })),
  ], [
    activityFilter,
    agents,
    refresh,
    searchQuery,
    selectedAgent,
    setActivityFilter,
    setSearchQuery,
    setSelectedAgent,
  ]);
}

export function useOpenScoutStatus(): { label: string; color: StatusColor } {
  const { agents, onlineCount, loading, error } = useOpenScout();

  if (loading && agents.length === 0) return { label: 'SYNC', color: 'amber' };
  if (error) return { label: 'ERROR', color: 'red' };
  if (agents.length === 0) return { label: 'IDLE', color: 'neutral' };
  if (onlineCount === 0) return { label: 'OFFLINE', color: 'amber' };
  if (onlineCount === agents.length) return { label: 'ALL LIVE', color: 'emerald' };
  return { label: `${onlineCount}/${agents.length} LIVE`, color: 'amber' };
}

export function useOpenScoutSearch(): SearchConfig {
  const { searchQuery, setSearchQuery } = useOpenScout();

  return useMemo(() => ({
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: 'Filter agents, projects, or messages...',
  }), [searchQuery, setSearchQuery]);
}
