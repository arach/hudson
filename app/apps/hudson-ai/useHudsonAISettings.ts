'use client';

import { useCallback, useMemo } from 'react';
import { useAppSettings, usePersistentState } from '@hudson/sdk';
import type { AppSettingsConfig, AppSettingsValues } from '@hudson/sdk';

interface HudsonAISettingsScope {
  resolvedSettings: AppSettingsValues;
  globalSettings: AppSettingsValues;
  updateGlobalSettings: (patch: Partial<AppSettingsValues>) => void;
  resetGlobalSettings: () => void;
  workspaceOverrideSettings: Partial<AppSettingsValues>;
  hasWorkspaceOverride: boolean;
  enableWorkspaceOverride: () => void;
  updateWorkspaceOverride: (patch: Partial<AppSettingsValues>) => void;
  clearWorkspaceOverride: () => void;
}

function hasValues(values: Partial<AppSettingsValues>) {
  return Object.keys(values).length > 0;
}

export function useHudsonAISettings(
  workspaceId: string,
  config: AppSettingsConfig,
): HudsonAISettingsScope {
  const [globalSettings, updateGlobalSettings, resetGlobalSettings] = useAppSettings('hudson-ai', config);
  const [workspaceOverrideSettings, setWorkspaceOverrideSettings] = usePersistentState<Partial<AppSettingsValues>>(
    `hudson.ws.${workspaceId}.app.hudson-ai.settings`,
    {},
  );

  const hasWorkspaceOverride = hasValues(workspaceOverrideSettings);

  const resolvedSettings = useMemo(() => {
    const next: AppSettingsValues = { ...globalSettings };
    for (const [key, value] of Object.entries(workspaceOverrideSettings)) {
      if (value !== undefined) next[key] = value;
    }
    return next;
  }, [globalSettings, workspaceOverrideSettings]);

  const enableWorkspaceOverride = useCallback(() => {
    setWorkspaceOverrideSettings(prev => (hasValues(prev) ? prev : resolvedSettings));
  }, [resolvedSettings, setWorkspaceOverrideSettings]);

  const updateWorkspaceOverride = useCallback(
    (patch: Partial<AppSettingsValues>) => {
      setWorkspaceOverrideSettings(prev => {
        const base = hasValues(prev) ? prev : resolvedSettings;
        const next = { ...base };
        for (const [key, value] of Object.entries(patch)) {
          if (value !== undefined) next[key] = value;
        }
        return next;
      });
    },
    [resolvedSettings, setWorkspaceOverrideSettings],
  );

  const clearWorkspaceOverride = useCallback(() => {
    setWorkspaceOverrideSettings({});
  }, [setWorkspaceOverrideSettings]);

  return {
    resolvedSettings,
    globalSettings,
    updateGlobalSettings,
    resetGlobalSettings,
    workspaceOverrideSettings,
    hasWorkspaceOverride,
    enableWorkspaceOverride,
    updateWorkspaceOverride,
    clearWorkspaceOverride,
  };
}
