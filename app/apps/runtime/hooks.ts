'use client';

import { useMemo, createElement } from 'react';
import type { CommandOption, SearchConfig, StatusColor } from 'hudsonkit';
import { useRuntime } from './RuntimeProvider';

export function useRuntimeCommands(): CommandOption[] {
  const {
    refresh,
    launchCompanion,
    sendAction,
    selectedNodeId,
    nodes,
    setSelectedNodeId,
  } = useRuntime();

  return useMemo<CommandOption[]>(() => [
    {
      id: 'runtime:refresh',
      label: 'Refresh Runtime Status',
      action: () => void refresh(),
      section: 'Runtime',
    },
    {
      id: 'runtime:launch-companion',
      label: 'Launch Runtime Companion',
      action: () => void launchCompanion(),
      section: 'Runtime',
    },
    {
      id: 'runtime:metrics',
      label: 'Fetch Runtime Metrics',
      action: () => void sendAction('metrics'),
      section: 'Runtime',
    },
    {
      id: 'runtime:viewport-fit',
      label: 'Fit Runtime Viewport',
      action: () => void sendAction('viewport', { fit: true }),
      section: 'Runtime',
    },
    ...(selectedNodeId
      ? [
          {
            id: 'runtime:focus-selected',
            label: 'Focus Selected Node',
            action: () => void sendAction('focus', { nodeID: selectedNodeId }),
            section: 'Runtime',
          },
        ]
      : []),
    ...nodes.map(node => ({
      id: `runtime:select:${node.id}`,
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

export function useRuntimeStatus(): { label: string; color: StatusColor } {
  const { phase, status, error, nodes } = useRuntime();

  if (phase === 'checking') return { label: 'PROBE', color: 'neutral' };
  if (error && !status?.online) return { label: 'ERROR', color: 'red' };
  if (!status?.online) return { label: 'OFFLINE', color: 'neutral' };
  if (nodes.length === 0) return { label: 'READY', color: 'neutral' };
  return { label: `${nodes.length} NODES`, color: 'neutral' };
}

export function useRuntimeSearch(): SearchConfig {
  const { searchQuery, setSearchQuery } = useRuntime();

  return useMemo(() => ({
    value: searchQuery,
    onChange: setSearchQuery,
    placeholder: 'Filter nodes by title, tag, or id',
  }), [searchQuery, setSearchQuery]);
}

export function useRuntimeNavCenter() {
  const { status } = useRuntime();
  if (!status?.workspaceID) return null;
  return createElement('span', {
    className: 'text-[10px] font-mono uppercase tracking-wider text-neutral-500',
  }, status.workspaceID);
}

export function useRuntimeLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
