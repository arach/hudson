import { useState, useEffect } from 'react';

// Inline context import to avoid circular deps — we read the raw context value.
// PlatformContext defaults to WEB_ADAPTER (isSSR: true) when no provider is present.
import { usePlatform } from '../platform/PlatformContext';

export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { isSSR } = usePlatform();

  const [state, setState] = useState<T>(() => {
    // In non-SSR environments (native hosts), read localStorage synchronously
    // to avoid a flash of default values.
    if (!isSSR) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return initialValue;
  });

  // In SSR environments, sync with localStorage after hydration
  useEffect(() => {
    if (!isSSR) return; // already read synchronously above
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setState(JSON.parse(saved));
      }
    } catch {}
  }, [key, isSSR]);

  // Persist changes to localStorage
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);

  return [state, setState];
}
