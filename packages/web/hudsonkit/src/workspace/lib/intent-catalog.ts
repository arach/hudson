import type {
  AppIntent,
  CatalogAppEntry,
  HudsonWorkspace,
  IntentCatalog,
  ServerIntent,
} from '../../index';
import { shellIntents } from '../shell/intents';

export interface BuildIntentCatalogOptions {
  /** Server-callable intents to attach to the catalog. Pass from the API
   *  route by calling `listIntents().map(({meta}) => intentMetaToServerIntent(meta))`.
   *  Omit on the client; the resulting catalog will simply have no
   *  `serverIntents` field, which is the correct UI view. */
  serverIntents?: ServerIntent[];
}

/**
 * Build a serializable intent catalog from a workspace definition.
 *
 * Pure function with no Node imports — safe to call from client code. UI
 * intents are indexed for `useIntentExecutor`. Server intents are surfaced
 * separately on `catalog.serverIntents`; they're never added to `index` or
 * `apps[].intents` because they aren't dispatchable from the UI and would
 * false-positive the executor's command-lookup warn loop.
 */
export function buildIntentCatalog(
  workspace: HudsonWorkspace,
  options: BuildIntentCatalogOptions = {},
): IntentCatalog {
  const index: Record<string, { appId: string; intent: AppIntent }> = {};

  for (const intent of shellIntents) {
    index[intent.commandId] = { appId: 'shell', intent };
  }

  const apps: CatalogAppEntry[] = workspace.apps.map((config) => {
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

  const serverIntents = options.serverIntents && options.serverIntents.length > 0
    ? [...options.serverIntents]
    : undefined;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    workspace: { id: workspace.id, name: workspace.name },
    shell: shellIntents,
    apps,
    index,
    serverIntents,
  };
}
