'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULTS, STUDIO_COOKIE, type StudioState } from './defaults';

interface StudioContextValue {
  state: StudioState;
  setState: (patch: Partial<StudioState> | ((prev: StudioState) => StudioState)) => void;
  set: <K extends keyof StudioState>(key: K, value: StudioState[K]) => void;
  reset: () => void;
  hydrated: boolean;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

function readStudioCookie(): Partial<StudioState> | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${STUDIO_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as Partial<StudioState>;
  } catch {
    return null;
  }
}

export function StudioProvider({
  initial,
  children,
}: {
  initial?: StudioState;
  children: ReactNode;
}) {
  const [state, setStateInternal] = useState<StudioState>(() => ({ ...DEFAULTS, ...initial }));
  const [hydrated, setHydrated] = useState(false);

  // Static export ships DEFAULTS HTML; rehydrate user prefs from the cookie
  // after mount so we don't trip a hydration mismatch.
  useEffect(() => {
    const fromCookie = readStudioCookie();
    if (fromCookie) {
      setStateInternal((prev) => ({ ...prev, ...fromCookie }));
    }
    setHydrated(true);
  }, []);

  const setState = useCallback(
    (patch: Partial<StudioState> | ((prev: StudioState) => StudioState)) => {
      setStateInternal((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }));
    },
    [],
  );

  const set = useCallback(<K extends keyof StudioState>(key: K, value: StudioState[K]) => {
    setStateInternal((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setStateInternal({ ...DEFAULTS }), []);

  return (
    <StudioContext.Provider value={{ state, setState, set, reset, hydrated }}>{children}</StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}
