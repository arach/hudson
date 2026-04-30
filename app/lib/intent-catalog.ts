import type { HudsonWorkspace, IntentCatalog, AppIntent } from 'hudsonkit';
import { shellIntents } from '../shell/intents';

/**
 * Build a serializable intent catalog from a workspace definition.
 * Pure function — no React, no side effects.
 */
export function buildIntentCatalog(workspace: HudsonWorkspace): IntentCatalog {
  const index: Record<string, { appId: string; intent: AppIntent }> = {};

  // Index shell intents
  for (const intent of shellIntents) {
    index[intent.commandId] = { appId: 'shell', intent };
  }

  // Build app entries + index
  const apps = workspace.apps.map(config => {
    const { app } = config;
    const intents = app.intents ?? [];

    for (const intent of intents) {
      index[intent.commandId] = { appId: app.id, intent };
    }

    return {
      appId: app.id,
      appName: app.name,
      appDescription: app.description ?? '',
      intents,
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    workspace: { id: workspace.id, name: workspace.name },
    shell: shellIntents,
    apps,
    index,
  };
}
