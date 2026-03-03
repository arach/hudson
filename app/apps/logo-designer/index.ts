import { Gem, ScanSearch } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { LogoProvider } from './LogoProvider';
import { LogoContent } from './LogoContent';
import { LogoLeftPanel } from './LogoLeftPanel';
import { LogoInspector } from './LogoInspector';
import { LogoTerminal } from './LogoTerminal';
import { useLogoCommands, useLogoStatus } from './hooks';
import { logoSettings } from './settings';

export const logoDesignerApp: HudsonApp = {
  id: 'logo-designer',
  name: 'Logo',
  description: 'Lattice logo designer and previewer',
  mode: 'panel',

  leftPanel: { title: 'Controls', icon: createElement(Gem, { size: 12 }) },
  rightPanel: { title: 'Export', icon: createElement(ScanSearch, { size: 12 }) },

  Provider: LogoProvider,

  settings: logoSettings,

  services: [
    { serviceId: 'relay', optional: true, reason: 'Required for AI terminal sessions and template compilation' },
  ],

  slots: {
    Content: LogoContent,
    LeftPanel: LogoLeftPanel,
    Inspector: LogoInspector,
    Terminal: LogoTerminal,
  },

  hooks: {
    useCommands: useLogoCommands,
    useStatus: useLogoStatus,
  },
};
