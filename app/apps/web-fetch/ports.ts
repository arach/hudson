'use client';

import { useCallback } from 'react';
import { useWebFetch } from './WebFetchProvider';

/**
 * Output port: provides the fetched image as a data URL string.
 */
export function useWebFetchPortOutput() {
  const { result } = useWebFetch();
  return useCallback((portId: string): unknown | null => {
    if (portId === 'image' && result) return result.dataUrl;
    return null;
  }, [result]);
}
