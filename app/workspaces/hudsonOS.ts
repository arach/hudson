import type { HudsonWorkspace } from '@hudson/sdk';
import { hudsonDocsApp } from '../apps/hudson-docs';
import { shaperApp } from '../apps/shaper';
import { intentExplorerApp } from '../apps/intent-explorer';

export const hudsonOSWorkspace: HudsonWorkspace = {
  id: 'hudson-os',
  name: 'Hudson OS',
  description: 'Multi-app canvas workspace',
  mode: 'canvas',
  apps: [
    { app: hudsonDocsApp, canvasMode: 'native' },
    {
      app: shaperApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -400, y: -300, w: 800, h: 600 },
    },
    {
      app: intentExplorerApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 200, y: -200, w: 680, h: 500 },
    },
  ],
  defaultFocusedAppId: 'hudson-docs',
};
