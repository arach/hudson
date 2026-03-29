import { Radio, SlidersHorizontal } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { OpenScoutProvider } from './OpenScoutProvider';
import { OpenScoutContent } from './OpenScoutContent';
import { OpenScoutLeftPanel } from './OpenScoutLeftPanel';
import { OpenScoutInspector } from './OpenScoutInspector';
import { OpenScoutLeftHeaderActions } from './OpenScoutHeaderActions';

export const openscoutApp: HudsonApp = {
  id: 'openscout',
  name: 'OpenScout',
  description: 'Agent relay monitor',
  mode: 'panel',

  Provider: OpenScoutProvider,

  leftPanel: {
    title: 'Agents',
    icon: createElement(Radio, { size: 12 }),
    headerActions: OpenScoutLeftHeaderActions,
  },

  rightPanel: {
    title: 'Inspector',
    icon: createElement(SlidersHorizontal, { size: 12 }),
  },

  slots: {
    Content: OpenScoutContent,
    LeftPanel: OpenScoutLeftPanel,
    Inspector: OpenScoutInspector,
  },

  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: 'Relay', color: 'neutral' }),
  },
};
