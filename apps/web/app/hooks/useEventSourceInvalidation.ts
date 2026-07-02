'use client';

import { useEffect, useRef, useState } from 'react';

interface UseEventSourceInvalidationOptions {
  url: string;
  onInvalidate: () => void | Promise<void>;
  enabled?: boolean;
  fallbackIntervalMs?: number;
}

export function useEventSourceInvalidation({
  url,
  onInvalidate,
  enabled = true,
  fallbackIntervalMs = 300_000,
}: UseEventSourceInvalidationOptions) {
  const onInvalidateRef = useRef(onInvalidate);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !pageVisible) return;

    let fallbackId: number | null = null;
    let closed = false;

    const stopFallback = () => {
      if (fallbackId === null) return;
      window.clearInterval(fallbackId);
      fallbackId = null;
    };

    const startFallback = () => {
      if (fallbackIntervalMs <= 0 || fallbackId !== null) return;
      fallbackId = window.setInterval(() => {
        void onInvalidateRef.current();
      }, fallbackIntervalMs);
    };

    void onInvalidateRef.current();

    const source = new EventSource(url);
    const handleInvalidate = () => {
      void onInvalidateRef.current();
    };

    source.addEventListener('invalidate', handleInvalidate);
    source.onopen = () => {
      stopFallback();
      void onInvalidateRef.current();
    };
    source.onerror = () => {
      if (!closed) startFallback();
    };

    return () => {
      closed = true;
      stopFallback();
      source.removeEventListener('invalidate', handleInvalidate);
      source.close();
    };
  }, [enabled, fallbackIntervalMs, pageVisible, url]);
}
