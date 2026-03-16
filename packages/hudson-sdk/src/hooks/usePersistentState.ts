import { useState, useEffect, useRef, useCallback } from 'react';

// Inline context import to avoid circular deps — we read the raw context value.
// PlatformContext defaults to WEB_ADAPTER (isSSR: true) when no provider is present.
import { usePlatform } from '../platform/PlatformContext';

function readStorage<T>(key: string): T | undefined {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return undefined;
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('hudson:saved', { detail: { key } }));
  } catch {}
}

export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { isSSR } = usePlatform();

  const [state, setState] = useState<T>(() => {
    // In non-SSR environments (native hosts), read localStorage synchronously
    // to avoid a flash of default values.
    if (!isSSR) {
      return readStorage<T>(key) ?? initialValue;
    }
    return initialValue;
  });

  // In SSR environments, sync with localStorage after hydration
  useEffect(() => {
    if (!isSSR) return; // already read synchronously above
    const saved = readStorage<T>(key);
    if (saved !== undefined) setState(saved);
  }, [key, isSSR]);

  // Persist changes to localStorage
  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  return [state, setState];
}

/**
 * Like usePersistentState but debounces writes to localStorage.
 * Ideal for high-frequency state like pan/zoom that changes every frame.
 */
export function useDebouncedPersistentState<T>(
  key: string,
  initialValue: T,
  delayMs = 300,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { isSSR } = usePlatform();

  const [state, setState] = useState<T>(() => {
    if (!isSSR) {
      return readStorage<T>(key) ?? initialValue;
    }
    return initialValue;
  });

  useEffect(() => {
    if (!isSSR) return;
    const saved = readStorage<T>(key);
    if (saved !== undefined) setState(saved);
  }, [key, isSSR]);

  // Debounced persist — only writes after state settles
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeStorage(key, state);
    }, delayMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key, state, delayMs]);

  // Also flush on unmount (page navigation, workspace switch)
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    return () => {
      writeStorage(key, stateRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [state, setState];
}

/** Debounce interval for the save indicator (coalesces rapid writes). */
const SAVE_INDICATOR_DEBOUNCE_MS = 800;
/** How long the "saved" state stays true before resetting. */
const SAVE_INDICATOR_VISIBLE_MS = 1_500;

/**
 * Listens for `hudson:saved` events and returns `true` briefly after a write.
 * Use this to show a subtle save indicator in the UI.
 */
export function useSaveIndicator(): boolean {
  const [visible, setVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(() => {
    // Debounce: reset the timer on each save event so rapid writes
    // produce a single flash after the burst settles.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);

    debounceRef.current = setTimeout(() => {
      setVisible(true);
      hideRef.current = setTimeout(() => setVisible(false), SAVE_INDICATOR_VISIBLE_MS);
    }, SAVE_INDICATOR_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    window.addEventListener('hudson:saved', handleSave);
    return () => {
      window.removeEventListener('hudson:saved', handleSave);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [handleSave]);

  return visible;
}
