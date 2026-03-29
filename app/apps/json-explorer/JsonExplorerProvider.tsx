'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { usePersistentState } from '@hudson/sdk';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface JsonExplorerContextValue {
  // Data
  rawInput: string;
  setRawInput: (s: string) => void;
  parsedData: unknown | null;
  parseError: string | null;
  loadJson: (input: string) => void;
  clear: () => void;

  // Navigation
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  selectedPath: string | null;
  setSelectedPath: (path: string | null) => void;

  // Filter
  filter: string;
  setFilter: (f: string) => void;

  // Stats
  nodeCount: number;
  depth: number;
  dataLabel: string;
}

const JsonExplorerContext = createContext<JsonExplorerContextValue | null>(null);

export function useJsonExplorer() {
  const ctx = useContext(JsonExplorerContext);
  if (!ctx) throw new Error('useJsonExplorer must be used inside JsonExplorerProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countNodes(val: unknown): number {
  if (val === null || typeof val !== 'object') return 1;
  if (Array.isArray(val)) return 1 + val.reduce((n, v) => n + countNodes(v), 0);
  return 1 + Object.values(val as object).reduce((n, v) => n + countNodes(v), 0);
}

function maxDepth(val: unknown, d = 0): number {
  if (val === null || typeof val !== 'object') return d;
  if (Array.isArray(val)) {
    return val.length === 0 ? d : Math.max(...val.map(v => maxDepth(v, d + 1)));
  }
  const vals = Object.values(val as object);
  return vals.length === 0 ? d : Math.max(...vals.map(v => maxDepth(v, d + 1)));
}

function collectPaths(val: unknown, prefix = '$'): string[] {
  const paths: string[] = [prefix];
  if (val !== null && typeof val === 'object') {
    const entries = Array.isArray(val)
      ? val.map((v, i) => [String(i), v] as const)
      : Object.entries(val as object);
    for (const [k, v] of entries) {
      paths.push(...collectPaths(v, `${prefix}.${k}`));
    }
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JsonExplorerProvider({ children }: { children: ReactNode }) {
  const [rawInput, setRawInput] = usePersistentState<string>('json-explorer.raw', '');
  const [parsedData, setParsedData] = useState<unknown | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['$']));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [dataLabel, setDataLabel] = useState('');

  const loadJson = useCallback((input: string) => {
    setRawInput(input);
    try {
      const parsed = JSON.parse(input);
      setParsedData(parsed);
      setParseError(null);
      setExpandedPaths(new Set(['$']));
      setSelectedPath(null);

      // Auto-label
      if (Array.isArray(parsed)) {
        setDataLabel(`Array [${parsed.length}]`);
      } else if (typeof parsed === 'object' && parsed !== null) {
        setDataLabel(`Object {${Object.keys(parsed).length}}`);
      } else {
        setDataLabel(typeof parsed);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
      setParsedData(null);
    }
  }, [setRawInput]);

  const clear = useCallback(() => {
    setRawInput('');
    setParsedData(null);
    setParseError(null);
    setExpandedPaths(new Set(['$']));
    setSelectedPath(null);
    setDataLabel('');
  }, [setRawInput]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!parsedData) return;
    setExpandedPaths(new Set(collectPaths(parsedData)));
  }, [parsedData]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['$']));
  }, []);

  const nodeCount = useMemo(() => parsedData !== null ? countNodes(parsedData) : 0, [parsedData]);
  const depth = useMemo(() => parsedData !== null ? maxDepth(parsedData) : 0, [parsedData]);

  const value: JsonExplorerContextValue = {
    rawInput, setRawInput, parsedData, parseError, loadJson, clear,
    expandedPaths, togglePath, expandAll, collapseAll,
    selectedPath, setSelectedPath,
    filter, setFilter,
    nodeCount, depth, dataLabel,
  };

  return (
    <JsonExplorerContext.Provider value={value}>
      {children}
    </JsonExplorerContext.Provider>
  );
}
