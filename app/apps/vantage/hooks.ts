'use client';

import { useMemo, createElement } from 'react';
import type { CommandOption, SearchConfig, StatusColor } from 'hudsonkit';
import { useVantage } from './VantageProvider';

export function useVantageCommands(): CommandOption[] {
  const {
    refresh,
    launchCompanion,
    sendAction,
    selectedNodeId,
    nodes,
    setSelectedNodeId,
  } = useVantage();

  return useMemo<CommandOption[]>(() => [
    {
      id: 'vantage:refresh',
      label: 'Refresh Vantage Status',
      action: () => void refresh(),
      section: 'Vantage',
    },
    {
      id: 'vantage:launch-companion',
      label: 'Launch Vantage Companion',
      action: () => void launchCompanion(),
      section: 'Vantage',
    },
    {
      id: 'vantage:metrics',
      label: 'Fetch Vantage Metrics',
      action: () => void sendAction('metrics'),
      section: 'Vantage',
    },
    {
      id: 'vantage:viewport-fit',
      label: 'Fit Vantage Viewport',
      action: () => void sendAction('viewport', { fit: true }),
      section: 'Vantage',
    },
    ...(selectedNodeId
      ? [
          {
            id: 'vantage:focus-selected',
            label: 'Focus Selected Node',
            action: () => void sendAction('focus', { nodeID: selectedNodeId }),
            section: 'Vantage',
          },
        ]
      : []),
    ...nodes.map(node => ({
      id: `vantage:select:${node.id}`,
      label: `Select Node: ${node.title ?? node.id.slice(0, 8)}`,
      action: () => {
        setSelectedNodeId(node.id);
        void sendAction('select', { nodeID: node.id, selectionMode: 'replace' });
      },
      section: 'Nodes',
    })),
  ], [
    launchCompanion,
    nodes,
    refresh,
    selectedNodeId,
    sendAction,
    setSelectedNodeId,
  ]);
}

export function useVantageStatus(): { label: string; color: StatusColor } {
  const { phase, status, error, nodes } = useVantage();

  if (phase === 'checking') return { label: 'PROBE', color: 'neutral' };
  if (error && !status?.online) return { label: 'ERROR', color: 'red' };
  if (!status?.online) return { label: 'OFFLINE', color: 'neutral' };
  if (nodes.length === 0) return { label: 'READY', color: 'neutral' };
  return { label: `${nodes.length} NODES`, color: 'neutral' };
}

export function useVantageSearch(): SearchConfig {
  const { searchQuery, setSearchQuery } = useVantage();

  return useMemo(() => ({
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: 'Filter nodes by title, tag, or id',
  }), [searchQuery, setSearchQuery]);
}

export function useVantageNavCenter() {
  const { status } = useVantage();
  if (!status?.workspaceID) return null;
  return createElement('span', {
    className: 'text-[10px] font-mono uppercase tracking-wider text-neutral-500',
  }, status.workspaceID);
}

export function useVantageLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
