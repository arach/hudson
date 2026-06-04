'use client';

import { useCallback } from 'react';
import { useApiInspector } from './ApiInspectorProvider';

// ---------------------------------------------------------------------------
// usePortOutput — export response JSON or raw body
// ---------------------------------------------------------------------------
export function useApiInspectorPortOutput() {
  const { response } = useApiInspector();

  return useCallback((portId: string): unknown | null => {
    if (!response) return null;

    if (portId === 'response-json') {
      if (response.bodyType !== 'json') return null;
      try {
        return JSON.parse(response.body);
      } catch {
        return null;
      }
    }

    if (portId === 'response-body') {
      return response.body;
    }

    return null;
  }, [response]);
}

// ---------------------------------------------------------------------------
// usePortInput — accept a URL to prefill
// ---------------------------------------------------------------------------
export function useApiInspectorPortInput() {
  const { setUrl, setMethod } = useApiInspector();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'url' && typeof data === 'string') {
      setUrl(data);
    }
    if (portId === 'request' && typeof data === 'object' && data !== null) {
      const req = data as { url?: string; method?: string };
      if (req.url) setUrl(req.url);
      if (req.method) setMethod(req.method as 'GET');
    }
  }, [setUrl, setMethod]);
}
