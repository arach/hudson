import { Server, List } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { ServicesProvider } from './ServicesProvider';
import { ServicesContent } from './ServicesContent';
import { ServicesLeftPanel } from './ServicesLeftPanel';
import { ServicesInspector } from './ServicesInspector';
import { ServicesTerminal } from './ServicesTerminal';
import { useServicesCommands, useServicesStatus } from './hooks';

export const servicesApp: HudsonApp = {
  id: 'services',
  name: 'Services',
  description: 'Manage Hudson background services',
  mode: 'panel',

  leftPanel: { title: 'Services', icon: createElement(List, { size: 12 }) },
  rightPanel: { title: 'Inspector' },

  Provider: ServicesProvider,

  slots: {
    Content: ServicesContent,
    LeftPanel: ServicesLeftPanel,
    Inspector: ServicesInspector,
    Terminal: ServicesTerminal,
  },

  hooks: {
    useCommands: useServicesCommands,
    useStatus: useServicesStatus,
  },
};
