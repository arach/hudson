import type { HudsonWorkspace } from '@hudson/sdk';
import { shaperApp } from '../apps/shaper';

export const shaperDevWorkspace: HudsonWorkspace = {
  id: 'shaper-dev',
  name: 'Shaper.dev',
  description: 'Standalone bezier curve editor',
  mode: 'panel',
  apps: [{ app: shaperApp }],
};
