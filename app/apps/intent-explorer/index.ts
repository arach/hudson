import { Zap, ScanSearch } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { IntentProvider } from './IntentProvider';
import { IntentContent } from './IntentContent';
import { IntentLeftPanel } from './IntentLeftPanel';
import { IntentRightPanel } from './IntentRightPanel';
import {
  useExplorerCommands,
  useExplorerStatus,
  useExplorerSearch,
  useExplorerLayoutMode,
} from './hooks';

export const intentExplorerApp: HudsonApp = {
  id: 'intent-explorer',
  name: 'Intents',
  description: 'Browse and inspect app intents',
  mode: 'panel',

  leftPanel: { title: 'Apps', icon: createElement(Zap, { size: 12 }) },
  rightPanel: { title: 'Inspector', icon: createElement(ScanSearch, { size: 12 }) },

  Provider: IntentProvider,

  slots: {
    Content: IntentContent,
    LeftPanel: IntentLeftPanel,
    Inspector: IntentRightPanel,
  },

  hooks: {
    useCommands: useExplorerCommands,
    useStatus: useExplorerStatus,
    useSearch: useExplorerSearch,
    useLayoutMode: useExplorerLayoutMode,
  },
};
