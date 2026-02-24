import { describe, it, expect } from 'vitest';
import { intentExplorerApp } from '@/app/apps/intent-explorer';
import type { HudsonApp } from '@hudson/sdk';
import { deriveManifest } from '@hudson/sdk';

describe('Intent Explorer app', () => {
  it('conforms to HudsonApp interface', () => {
    const app: HudsonApp = intentExplorerApp;
    expect(app.id).toBe('intent-explorer');
    expect(app.name).toBe('Intents');
    expect(app.mode).toBe('panel');
    expect(app.Provider).toBeDefined();
    expect(app.slots.Content).toBeDefined();
    expect(app.hooks.useCommands).toBeTypeOf('function');
    expect(app.hooks.useStatus).toBeTypeOf('function');
    expect(app.hooks.useLayoutMode).toBeTypeOf('function');
  });

  it('has required slot types', () => {
    expect(intentExplorerApp.slots.LeftPanel).toBeDefined();
    expect(intentExplorerApp.slots.Inspector).toBeDefined();
  });

  it('derives a manifest', () => {
    const manifest = deriveManifest(intentExplorerApp);
    expect(manifest.id).toBe('intent-explorer');
    expect(manifest.name).toBe('Intents');
    expect(manifest.mode).toBe('panel');
  });
});
