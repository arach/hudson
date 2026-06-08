'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createFlagResolver } from './resolver';
import { readFeatureFlagLocalState, writeFeatureFlagLocalState } from './storage';
import type {
  FeatureFlagAudience,
  FeatureFlagLayerInput,
  FeatureFlagLayers,
  FeatureFlagLocalState,
  FeatureFlagRegistry,
  FeatureFlagResolution,
  FeatureFlagsContextValue,
  FeatureFlagsProviderProps,
} from './types';

const DEFAULT_STORAGE_KEY = 'hudson.flags';
const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export function FeatureFlagsProvider<R extends FeatureFlagRegistry, TAudience extends string = string>({
  registry,
  audience,
  audienceOrder,
  audienceIncludes,
  initialLayers,
  storageKey = DEFAULT_STORAGE_KEY,
  warnOnUnknown = process.env.NODE_ENV !== 'production',
  children,
}: FeatureFlagsProviderProps<R, TAudience>) {
  const [localState, setLocalState] = useState<FeatureFlagLocalState<TAudience>>(() => {
    const initialLocal = initialLayers?.local;
    return { version: 1, audience: initialLocal?.audience ?? undefined, flags: flagsFromLayer(initialLocal) };
  });

  useEffect(() => {
    const stored = readFeatureFlagLocalState<TAudience>(storageKey);
    if (stored.audience || Object.keys(stored.flags ?? {}).length > 0) setLocalState(stored);
  }, [storageKey]);

  const layers = useMemo<FeatureFlagLayers<TAudience>>(() => ({
    ...initialLayers,
    local: {
      ...initialLayers?.local,
      audience: localState.audience ?? initialLayers?.local?.audience,
      flags: { ...(initialLayers?.local?.flags ?? {}), ...(localState.flags ?? {}) },
    },
  }), [initialLayers, localState]);

  const resolver = useMemo(() => createFlagResolver({ registry, audience, audienceOrder, audienceIncludes, layers, warnOnUnknown }), [registry, audience, audienceOrder, audienceIncludes, layers, warnOnUnknown]);

  const value = useMemo<FeatureFlagsContextValue<R, TAudience>>(() => ({
    ...resolver,
    layers,
    storageKey,
    setLocalOverride: (key, flagValue) => {
      setLocalState(prev => {
        const flags = { ...(prev.flags ?? {}) };
        if (flagValue === null) delete flags[key];
        else flags[key] = flagValue;
        const next = { ...prev, version: 1 as const, flags };
        writeFeatureFlagLocalState(storageKey, next);
        return next;
      });
    },
    setLocalAudienceOverride: (tier) => {
      setLocalState(prev => {
        const next = { ...prev, version: 1 as const, audience: tier ?? undefined };
        writeFeatureFlagLocalState(storageKey, next);
        return next;
      });
    },
    resetLocalOverrides: () => {
      const next = { version: 1 as const };
      writeFeatureFlagLocalState(storageKey, next);
      setLocalState(next);
    },
  }), [resolver, layers, storageKey]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useOptionalFeatureFlags(): FeatureFlagsContextValue | null {
  return useContext(FeatureFlagsContext);
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useOptionalFeatureFlags();
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return ctx;
}

export function useFlag(key: string): boolean {
  return useFeatureFlags().isEnabled(key);
}

export function useOptionalFlag(key: string, fallback = true): boolean {
  return useOptionalFeatureFlags()?.isEnabled(key) ?? fallback;
}

export function useFlagResolution(key: string): FeatureFlagResolution {
  return useFeatureFlags().explain(key);
}

export function createFeatureFlagBootstrap<TAudience extends string = string>(input: { audience: FeatureFlagAudience<TAudience>; layers?: FeatureFlagLayers<TAudience> }) {
  return input;
}

function flagsFromLayer<TAudience extends string>(layer?: FeatureFlagLayerInput<TAudience>): Record<string, boolean> | undefined {
  if (!layer?.flags) return undefined;
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(layer.flags)) {
    if (value === true || value === false) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
