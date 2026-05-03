'use client';

import { useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import type { AppSettingsConfig } from '../types/app';

export type AppSettingsValues = Record<string, string | number | boolean>;

/**
 * Hook that manages per-app settings backed by localStorage.
 * Returns [values, update, reset] — similar to useState but with merge semantics.
 */
export function useAppSettings(
  appId: string,
  config: AppSettingsConfig,
): [AppSettingsValues, (patch: Partial<AppSettingsValues>) => void, () => void] {
  // Compute defaults from config
  const defaults = useMemo(() => {
    const d: AppSettingsValues = {};
    for (const section of config.sections) {
      for (const field of section.fields) {
        d[field.key] = field.default;
      }
    }
    return d;
  }, [config]);

  const [values, setValues] = usePersistentState<AppSettingsValues>(
    `hudson.app.${appId}.settings`,
    defaults,
  );

  const update = useCallback(
    (patch: Partial<AppSettingsValues>) => {
      setValues(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          if (v !== undefined) next[k] = v;
        }
        return next;
      });
    },
    [setValues],
  );

  const reset = useCallback(() => {
    setValues(defaults);
  }, [setValues, defaults]);

  // Merge stored values with defaults (in case new fields were added)
  const merged = useMemo(() => ({ ...defaults, ...values }), [defaults, values]);

  return [merged, update, reset];
}
