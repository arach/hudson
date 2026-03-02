import { Gem } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { LogoProvider } from './LogoProvider';
import { LogoContent } from './LogoContent';
import { LogoLeftPanel } from './LogoLeftPanel';
import { LogoTerminal } from './LogoTerminal';
import { useLogoCommands, useLogoStatus } from './hooks';

export const logoDesignerApp: HudsonApp = {
  id: 'logo-designer',
  name: 'Logo',
  description: 'Lattice logo designer and previewer',
  mode: 'panel',

  leftPanel: { title: 'Controls', icon: createElement(Gem, { size: 12 }) },

  Provider: LogoProvider,

  slots: {
    Content: LogoContent,
    LeftPanel: LogoLeftPanel,
    Terminal: LogoTerminal,
  },

  hooks: {
    useCommands: useLogoCommands,
    useStatus: useLogoStatus,
  },
};
