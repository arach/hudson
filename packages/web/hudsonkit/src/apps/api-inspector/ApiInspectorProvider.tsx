'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { usePersistentState } from '../../index';
import { useWorkspaceHostRoutes } from '../../workspace/hostRoutes';
import type {
  HttpMethod,
  ApiRequest,
  ApiResponse,
  KeyValuePair,
  RequestTab,
  ResponseTab,
  HistoryEntry,
} from './types';
import { emptyKeyValue, newId } from './types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ApiInspectorContextValue {
  // Current request
  request: ApiRequest;
  setMethod: (m: HttpMethod) => void;
  setUrl: (url: string) => void;
  setHeaders: (h: KeyValuePair[]) => void;
  setParams: (p: KeyValuePair[]) => void;
  setBody: (b: string) => void;
  setBodyType: (t: ApiRequest['bodyType']) => void;
  addHeader: () => void;
  removeHeader: (id: string) => void;
  updateHeader: (id: string, field: 'key' | 'value', val: string) => void;
  toggleHeader: (id: string) => void;
  addParam: () => void;
  removeParam: (id: string) => void;
  updateParam: (id: string, field: 'key' | 'value', val: string) => void;
  toggleParam: (id: string) => void;

  // Response
  response: ApiResponse | null;
  responseError: string | null;
  loading: boolean;

  // Actions
  sendRequest: () => Promise<void>;
  clearResponse: () => void;

  // Tabs
  requestTab: RequestTab;
  setRequestTab: (t: RequestTab) => void;
  responseTab: ResponseTab;
  setResponseTab: (t: ResponseTab) => void;

  // History
  history: HistoryEntry[];
  clearHistory: () => void;
  loadFromHistory: (entry: HistoryEntry) => void;
  deleteHistoryEntry: (id: string) => void;

  // Method dropdown
  methodOpen: boolean;
  setMethodOpen: (open: boolean) => void;
}

const ApiInspectorContext = createContext<ApiInspectorContextValue | null>(null);

export function useApiInspector() {
  const ctx = useContext(ApiInspectorContext);
  if (!ctx) throw new Error('useApiInspector must be used inside ApiInspectorProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ApiInspectorProvider({ children }: { children: ReactNode }) {
  const routes = useWorkspaceHostRoutes();
  // --- Request state ---
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = usePersistentState<string>('api-inspector.url', '');
  const [headers, setHeaders] = useState<KeyValuePair[]>([emptyKeyValue()]);
  const [params, setParams] = useState<KeyValuePair[]>([emptyKeyValue()]);
  const [body, setBody] = useState('');
  const [bodyType, setBodyType] = useState<ApiRequest['bodyType']>('none');

  // --- Response state ---
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Tabs ---
  const [requestTab, setRequestTab] = useState<RequestTab>('params');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');

  // --- History ---
  const [history, setHistory] = usePersistentState<HistoryEntry[]>('api-inspector.history', []);

  // --- Method dropdown ---
  const [methodOpen, setMethodOpen] = useState(false);

  // --- Abort controller ---
  const abortRef = useRef<AbortController | null>(null);

  // --- Key-value helpers ---
  const addHeader = useCallback(() => setHeaders(h => [...h, emptyKeyValue()]), []);
  const removeHeader = useCallback((id: string) => setHeaders(h => h.filter(kv => kv.id !== id)), []);
  const updateHeader = useCallback((id: string, field: 'key' | 'value', val: string) => {
    setHeaders(h => h.map(kv => kv.id === id ? { ...kv, [field]: val } : kv));
  }, []);
  const toggleHeader = useCallback((id: string) => {
    setHeaders(h => h.map(kv => kv.id === id ? { ...kv, enabled: !kv.enabled } : kv));
  }, []);

  const addParam = useCallback(() => setParams(p => [...p, emptyKeyValue()]), []);
  const removeParam = useCallback((id: string) => setParams(p => p.filter(kv => kv.id !== id)), []);
  const updateParam = useCallback((id: string, field: 'key' | 'value', val: string) => {
    setParams(p => p.map(kv => kv.id === id ? { ...kv, [field]: val } : kv));
  }, []);
  const toggleParam = useCallback((id: string) => {
    setParams(p => p.map(kv => kv.id === id ? { ...kv, enabled: !kv.enabled } : kv));
  }, []);

  // --- Build final URL with query params ---
  const buildUrl = useCallback(() => {
    const finalUrl = url.trim();
    const activeParams = params.filter(p => p.enabled && p.key.trim());
    if (activeParams.length === 0) return finalUrl;

    try {
      const u = new URL(finalUrl);
      activeParams.forEach(p => u.searchParams.set(p.key, p.value));
      return u.toString();
    } catch {
      // If URL is invalid, just append query string manually
      const qs = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      return `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}${qs}`;
    }
  }, [url, params]);

  // --- Send request ---
  const sendRequest = useCallback(async () => {
    if (!url.trim()) return;
    if (!routes.apiProxy) {
      setResponseError('API proxy route is not configured for this host.');
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setResponseError(null);
    setResponse(null);

    const finalUrl = buildUrl();
    const activeHeaders: Record<string, string> = {};
    headers.filter(h => h.enabled && h.key.trim()).forEach(h => {
      activeHeaders[h.key] = h.value;
    });

    const reqSnapshot: ApiRequest = {
      method,
      url: finalUrl,
      headers: headers.filter(h => h.key.trim()),
      params: params.filter(p => p.key.trim()),
      body,
      bodyType,
    };

    try {
      const proxyPayload: Record<string, unknown> = {
        method,
        url: finalUrl,
        headers: activeHeaders,
      };
      if (bodyType !== 'none' && !['GET', 'HEAD'].includes(method)) {
        proxyPayload.body = body;
      }

      const res = await fetch(routes.apiProxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyPayload),
        signal: abortRef.current.signal,
      });

      const data = await res.json();

      if (data.error) {
        setResponseError(data.error);
        setHistory(prev => [{
          id: newId(),
          timestamp: Date.now(),
          request: reqSnapshot,
          response: null,
          error: data.error,
        }, ...prev].slice(0, 50));
      } else {
        const apiResponse: ApiResponse = {
          status: data.status,
          statusText: data.statusText,
          headers: data.headers,
          body: data.body,
          bodyType: data.bodyType,
          size: data.size,
          timing: data.timing,
        };
        setResponse(apiResponse);
        setHistory(prev => [{
          id: newId(),
          timestamp: Date.now(),
          request: reqSnapshot,
          response: apiResponse,
        }, ...prev].slice(0, 50));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Request failed';
      setResponseError(msg);
    } finally {
      setLoading(false);
    }
  }, [url, routes.apiProxy, method, headers, params, body, bodyType, buildUrl, setHistory]);

  // --- Clear response ---
  const clearResponse = useCallback(() => {
    setResponse(null);
    setResponseError(null);
  }, []);

  // --- History actions ---
  const clearHistory = useCallback(() => setHistory([]), [setHistory]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setMethod(entry.request.method);
    setUrl(entry.request.url);
    setHeaders(entry.request.headers.length ? entry.request.headers : [emptyKeyValue()]);
    setParams(entry.request.params.length ? entry.request.params : [emptyKeyValue()]);
    setBody(entry.request.body);
    setBodyType(entry.request.bodyType);
    if (entry.response) {
      setResponse(entry.response);
      setResponseError(null);
    } else if (entry.error) {
      setResponse(null);
      setResponseError(entry.error);
    }
  }, [setUrl]);

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, [setHistory]);

  // --- Assemble request object for reading ---
  const request = useMemo<ApiRequest>(
    () => ({ method, url, headers, params, body, bodyType }),
    [method, url, headers, params, body, bodyType],
  );

  const value = useMemo<ApiInspectorContextValue>(() => ({
    request, setMethod, setUrl, setHeaders, setParams, setBody, setBodyType,
    addHeader, removeHeader, updateHeader, toggleHeader,
    addParam, removeParam, updateParam, toggleParam,
    response, responseError, loading,
    sendRequest, clearResponse,
    requestTab, setRequestTab, responseTab, setResponseTab,
    history, clearHistory, loadFromHistory, deleteHistoryEntry,
    methodOpen, setMethodOpen,
  }), [
    request, setUrl, addHeader, removeHeader, updateHeader, toggleHeader,
    addParam, removeParam, updateParam, toggleParam,
    response, responseError, loading,
    sendRequest, clearResponse,
    requestTab, responseTab,
    history, clearHistory, loadFromHistory, deleteHistoryEntry,
    methodOpen,
  ]);

  return (
    <ApiInspectorContext.Provider value={value}>
      {children}
    </ApiInspectorContext.Provider>
  );
}
