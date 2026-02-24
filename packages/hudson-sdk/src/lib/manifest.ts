import type { HudsonApp, AppManifest } from '../types/app';

/**
 * Derive a serializable manifest from a HudsonApp definition.
 * If the app already provides a static manifest, returns it directly.
 * Otherwise builds one from the app's top-level fields.
 */
export function deriveManifest(app: HudsonApp): AppManifest {
  if (app.manifest) return app.manifest;

  return {
    id: app.id,
    name: app.name,
    description: app.description,
    mode: app.mode,
    tools: app.tools?.map(t => ({ id: t.id, name: t.name })),
  };
}
