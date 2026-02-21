import type { HudsonWorkspace } from 'frame-ui';
import { shaperApp } from '../apps/shaper';

export const shaperDevWorkspace: HudsonWorkspace = {
  id: 'shaper-dev',
  name: 'Shaper.dev',
  description: 'Standalone bezier curve editor',
  mode: 'panel',
  apps: [{ app: shaperApp }],
};
