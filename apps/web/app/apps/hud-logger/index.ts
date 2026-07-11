import { createElement } from 'react';
import { Activity } from 'hudsonkit/icons';
import type { AppManifest, HudsonApp } from 'hudsonkit';
import { HudLoggerContent } from './HudLoggerContent';
import { HudLoggerProvider } from './HudLoggerProvider';
import {
  useHudLoggerCommands,
  useHudLoggerLayoutMode,
  useHudLoggerStatus,
} from './hooks';

const hudLoggerManifest: AppManifest = {
  id: 'hud-logger',
  name: 'HudLogger',
  description: 'Inspect Hudson logs, metrics, and spans',
  mode: 'panel',
  commands: [
    { id: 'hud-logger:emit-info', label: 'Emit info event' },
    { id: 'hud-logger:emit-warning', label: 'Emit warning event' },
    { id: 'hud-logger:clear', label: 'Clear logger buffer' },
  ],
};

export const hudLoggerApp: HudsonApp = {
  id: 'hud-logger',
  name: 'HudLogger',
  description: 'Inspect Hudson logs, metrics, and spans',
  mode: 'panel',
  icon: createElement(Activity, { size: 14 }),
  manifest: hudLoggerManifest,

  Provider: HudLoggerProvider,

  slots: {
    Content: HudLoggerContent,
  },

  hooks: {
    useCommands: useHudLoggerCommands,
    useStatus: useHudLoggerStatus,
    useLayoutMode: useHudLoggerLayoutMode,
  },
};
