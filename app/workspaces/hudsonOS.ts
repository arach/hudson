import type { HudsonWorkspace } from 'frame-ui';
import { hudsonDocsApp } from '../apps/hudson-docs';
import { shaperApp } from '../apps/shaper';

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
  ],
  defaultFocusedAppId: 'hudson-docs',
};
