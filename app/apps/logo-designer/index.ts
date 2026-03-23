import { Gem } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { LogoProvider } from './LogoProvider';
import { LogoContent } from './LogoContent';
import { LogoTerminal } from './LogoTerminal';
import { useLogoCommands, useLogoStatus } from './hooks';
import { useLogoPortOutput, useLogoPortInput } from './ports';
import { logoSettings } from './settings';

export const logoDesignerApp: HudsonApp = {
  id: 'logo-designer',
  name: 'Logo',
  description: 'Lattice logo designer and previewer',
  mode: 'panel',

  ports: {
    outputs: [
      { id: 'params', name: 'Logo Params', dataType: 'json', description: 'Current logo parameters as JSON' },
    ],
    inputs: [
      { id: 'background-svg', name: 'Background SVG', dataType: 'svg', description: 'SVG to use as logo background layer' },
    ],
  },

  leftPanel: { title: 'Logo', icon: createElement(Gem, { size: 12 }) },

  Provider: LogoProvider,

  settings: logoSettings,

  services: [
    { serviceId: 'relay', optional: true, reason: 'Required for AI terminal sessions and template compilation' },
  ],

  slots: {
    Content: LogoContent,
    Terminal: LogoTerminal,
  },

  hooks: {
    useCommands: useLogoCommands,
    useStatus: useLogoStatus,
    usePortOutput: useLogoPortOutput,
    usePortInput: useLogoPortInput,
  },
};
