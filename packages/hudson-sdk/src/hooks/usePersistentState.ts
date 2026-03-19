import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';

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

// Hydration gate — ensures client and server render the same initial value,
// then swaps to the persisted value in a single synchronous commit.
const subscribeNoop = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

/** Returns false during SSR/hydration, true once the client has mounted. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, getTrue, getFalse);
}

export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const hydrated = useHydrated();

  const [state, setState] = useState<T>(initialValue);

  // After hydration, synchronously swap in the persisted value (single commit, no flash)
  const didRestore = useRef(false);
  if (hydrated && !didRestore.current) {
    didRestore.current = true;
    const saved = readStorage<T>(key);
    if (saved !== undefined) {
      // Direct state mutation before render — React 19 allows this in render phase
      // via the "if state changed during render, re-render with new state" path
      setState(saved);
    }
  }

  // Persist changes to localStorage
  useEffect(() => {
    if (!hydrated) return;
    writeStorage(key, state);
  }, [key, state, hydrated]);

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
  const hydrated = useHydrated();

  const [state, setState] = useState<T>(initialValue);

  const didRestore = useRef(false);
  if (hydrated && !didRestore.current) {
    didRestore.current = true;
    const saved = readStorage<T>(key);
    if (saved !== undefined) {
      setState(saved);
    }
  }

  // Debounced persist — only writes after state settles
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeStorage(key, state);
    }, delayMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key, state, delayMs, hydrated]);

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
