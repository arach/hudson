import { Gem, SlidersHorizontal } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from 'hudsonkit';
import { LogoProvider } from './LogoProvider';
import { LogoContent } from './LogoContent';
import { LogoLeftPanel } from './LogoLeftPanel';
import { LogoInspector, LogoInspectorHeaderActions } from './LogoInspector';
import { LogoTerminal } from './LogoTerminal';
import { LogoChat } from './LogoChat';
import { useLogoCommands, useLogoStatus } from './hooks';
import { useLogoPortOutput, useLogoPortInput } from './ports';
import { logoSettings } from './settings';
import { logoIntents } from './intents';

const IS_DEV_ENV = process.env.NODE_ENV === 'development';

export const logoDesignerApp: HudsonApp = {
  id: 'logo-designer',
  name: 'Logo',
  description: 'Lattice logo designer and previewer',
  mode: 'panel',

  ports: {
    outputs: [
      { id: 'params', name: 'Logo Params', dataType: 'json', description: 'Current logo parameters as JSON' },
      { id: 'animation-job', name: 'Animation Job', dataType: 'json', description: 'Selected logo variant payload for Preframe animation' },
    ],
    inputs: [
      { id: 'background-svg', name: 'Background SVG', dataType: 'svg', description: 'SVG to use as logo background layer' },
    ],
  },

  leftPanel: { title: 'Logo', icon: createElement(Gem, { size: 12 }) },
  rightPanel: { title: 'Inspector', icon: createElement(SlidersHorizontal, { size: 12 }), headerActions: LogoInspectorHeaderActions },

  Provider: LogoProvider,

  intents: logoIntents,

  settings: logoSettings,

  services: [
    { serviceId: 'relay', optional: true, reason: 'Required for AI terminal sessions and template compilation' },
    ...(IS_DEV_ENV
      ? [{ serviceId: 'preframe', optional: true, reason: 'Required for Logo animation render jobs' }]
      : []),
  ],

  slots: {
    Content: LogoContent,
    LeftPanel: LogoLeftPanel,
    Inspector: LogoInspector,
    Chat: LogoChat,
    Terminal: LogoTerminal,
  },

  hooks: {
    useCommands: useLogoCommands,
    useStatus: useLogoStatus,
    usePortOutput: useLogoPortOutput,
    usePortInput: useLogoPortInput,
  },
};
