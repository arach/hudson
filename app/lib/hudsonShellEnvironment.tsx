import { useMemo } from 'react';
import type { WorkspaceAppConfig } from 'hudsonkit';
import { TerminalContent } from '../apps/terminal/TerminalContent';
import { useHudsonAISettings } from '../apps/hudson-ai/useHudsonAISettings';
import { createHudsonAISettings } from '../apps/hudson-ai/settings';
import { useAIModelOptions } from './useAIModelOptions';
import type { AppSettingsEntry, WorkspaceShellEnvironment } from 'hudsonkit/workspace';

/**
 * Hudson's concrete bindings for the host WorkspaceShell's injectable surfaces.
 *
 * This lives in app/ (not the kit) because it imports Hudson's own apps. The
 * shell stays app-agnostic and reaches these only through the `environment`
 * prop — which is what lets the shell move into hudsonkit while Hudson keeps
 * supplying its apps. As more reaches are inverted (intents, service registry,
 * /api endpoints) they get bound here.
 */
function useHudsonAISettingsEntry(
  config: WorkspaceAppConfig | null,
  workspaceId: string,
): AppSettingsEntry | null {
  const { modelOptions } = useAIModelOptions();
  const settingsConfig = useMemo(() => createHudsonAISettings(modelOptions), [modelOptions]);
  const scoped = useHudsonAISettings(workspaceId, settingsConfig);
  return {
    appId: config?.app.id ?? 'hudson-ai',
    appName: config?.app.name ?? 'Hudson AI',
    config: settingsConfig,
    values: scoped.resolvedSettings,
    onUpdate: scoped.updateWorkspaceOverride,
  };
}

export const hudsonShellEnvironment: WorkspaceShellEnvironment = {
  renderTerminal: (opts) => <TerminalContent {...opts} />,
  useHudsonAISettingsEntry,
};
