import { useState, useEffect } from 'react';

export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Always use initialValue for first render (both server and client)
  // to avoid hydration mismatch
  const [state, setState] = useState<T>(initialValue);

  // After hydration, sync with localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setState(JSON.parse(saved));
      }
    } catch {}
  }, [key]);

  // Persist changes to localStorage
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);

  return [state, setState];
}
