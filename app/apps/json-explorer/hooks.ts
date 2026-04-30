'use client';

import { useMemo, createElement } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useJsonExplorer } from './JsonExplorerProvider';

// ---------------------------------------------------------------------------
// useCommands
// ---------------------------------------------------------------------------
export function useJsonExplorerCommands(): CommandOption[] {
  const { expandAll, collapseAll, clear, loadJson } = useJsonExplorer();

  return useMemo<CommandOption[]>(() => [
    { id: 'json-explorer:expand-all', label: 'Expand All Nodes', action: expandAll },
    { id: 'json-explorer:collapse-all', label: 'Collapse All Nodes', action: collapseAll },
    { id: 'json-explorer:clear', label: 'Clear Data', action: clear },
    {
      id: 'json-explorer:paste',
      label: 'Paste from Clipboard',
      action: () => navigator.clipboard.readText().then(t => { if (t.trim()) loadJson(t); }),
      shortcut: 'Cmd+V',
    },
  ], [expandAll, collapseAll, clear, loadJson]);
}

// ---------------------------------------------------------------------------
// useStatus
// ---------------------------------------------------------------------------
export function useJsonExplorerStatus(): { label: string; color: StatusColor } {
  const { parsedData, parseError, nodeCount } = useJsonExplorer();
  if (parseError) return { label: 'ERROR', color: 'red' };
  if (parsedData !== null) return { label: `${nodeCount} nodes`, color: 'emerald' };
  return { label: 'EMPTY', color: 'neutral' };
}

// ---------------------------------------------------------------------------
// useNavCenter
// ---------------------------------------------------------------------------
export function useJsonExplorerNavCenter() {
  const { dataLabel } = useJsonExplorer();
  if (!dataLabel) return null;
  return createElement('span', {
    className: 'text-[10px] font-mono text-neutral-500 uppercase tracking-wider',
  }, dataLabel);
}

// ---------------------------------------------------------------------------
// useLayoutMode
// ---------------------------------------------------------------------------
export function useJsonExplorerLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
