'use client';

import { useCallback } from 'react';
import { useJsonExplorer } from './JsonExplorerProvider';

// ---------------------------------------------------------------------------
// usePortOutput — export parsed JSON or selected node value
// ---------------------------------------------------------------------------
export function useJsonExplorerPortOutput() {
  const { parsedData, selectedPath } = useJsonExplorer();

  return useCallback((portId: string): unknown | null => {
    if (portId === 'json' && parsedData !== null) {
      return parsedData;
    }
    if (portId === 'selected') {
      if (!selectedPath || parsedData === null) return null;
      // Resolve path
      if (selectedPath === '$') return parsedData;
      const parts = selectedPath.slice(2).split('.');
      let current: unknown = parsedData;
      for (const part of parts) {
        if (current === null || typeof current !== 'object') return null;
        current = (current as Record<string, unknown>)[part];
      }
      return current ?? null;
    }
    return null;
  }, [parsedData, selectedPath]);
}

// ---------------------------------------------------------------------------
// usePortInput — accept JSON data from other apps
// ---------------------------------------------------------------------------
export function useJsonExplorerPortInput() {
  const { loadJson } = useJsonExplorer();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'json') {
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      loadJson(text);
    }
  }, [loadJson]);
}
