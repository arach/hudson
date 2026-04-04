'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { usePlatform, usePersistentState } from '@hudson/sdk';

export interface FetchResult {
  dataUrl: string;
  contentType: string;
  size: number;
  sourceUrl: string;
}

export interface FetchHistoryEntry {
  url: string;
  contentType: string;
  size: number;
  fetchedAt: number;
}

interface WebFetchState {
  url: string;
  setUrl: (url: string) => void;
  result: FetchResult | null;
  loading: boolean;
  error: string | null;
  fetchImage: () => Promise<void>;
  history: FetchHistoryEntry[];
  clearHistory: () => void;
}

const Ctx = createContext<WebFetchState | null>(null);

export function useWebFetch() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWebFetch must be inside WebFetchProvider');
  return ctx;
}

export function WebFetchProvider({ children }: { children: ReactNode }) {
  const { apiBaseUrl } = usePlatform();
  const [url, setUrl] = usePersistentState<string>('web-fetch.url', '');
  const [result, setResult] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = usePersistentState<FetchHistoryEntry[]>('web-fetch.history', []);

  // Persist last result to sessionStorage (survives re-renders, not full page reload for large data URLs)
  // Use localStorage for the metadata, sessionStorage for the heavy data URL
  const [lastResultMeta, setLastResultMeta] = usePersistentState<Omit<FetchResult, 'dataUrl'> | null>('web-fetch.lastResult', null);

  // Restore last result on mount
  useEffect(() => {
    if (result) return; // Already have a result
    if (!lastResultMeta) return;
    try {
      const cached = sessionStorage.getItem('web-fetch.dataUrl');
      if (cached) {
        setResult({ ...lastResultMeta, dataUrl: cached });
      }
    } catch { /* sessionStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchImage = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/fetch-image?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);

      // Persist result
      const { dataUrl, ...meta } = data;
      setLastResultMeta(meta);
      try { sessionStorage.setItem('web-fetch.dataUrl', dataUrl); } catch { /* quota */ }

      // Add to persistent history (dedup by URL, keep last 20)
      setHistory(prev => [
        { url: url.trim(), contentType: data.contentType, size: data.size, fetchedAt: Date.now() },
        ...prev.filter(h => h.url !== url.trim()),
      ].slice(0, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [url, apiBaseUrl, setHistory, setLastResultMeta]);

  const clearHistory = useCallback(() => setHistory([]), [setHistory]);

  const value = useMemo<WebFetchState>(() => ({
    url, setUrl, result, loading, error, fetchImage, history, clearHistory,
  }), [url, setUrl, result, loading, error, fetchImage, history, clearHistory]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}
