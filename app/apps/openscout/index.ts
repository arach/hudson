import { Radio, SlidersHorizontal } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from 'hudsonkit';
import { OpenScoutProvider } from './OpenScoutProvider';
import { OpenScoutContent } from './OpenScoutContent';
import { OpenScoutLeftPanel } from './OpenScoutLeftPanel';
import { OpenScoutInspector } from './OpenScoutInspector';
import { OpenScoutLeftHeaderActions } from './OpenScoutHeaderActions';
import { useOpenScoutCommands, useOpenScoutSearch, useOpenScoutStatus } from './hooks';
import { useOpenScoutPortOutput } from './ports';

export const openscoutApp: HudsonApp = {
  id: 'openscout',
  name: 'OpenScout',
  description: 'Scout operator console for agents, traffic, and relay activity',
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

  ports: {
    outputs: [
      { id: 'agents', name: 'Agents', dataType: 'json', description: 'Visible Scout agent records' },
      { id: 'channel', name: 'Channel Feed', dataType: 'json', description: 'Currently scoped relay entries' },
      { id: 'selected-agent', name: 'Selected Agent', dataType: 'json', description: 'The currently selected Scout agent record' },
      { id: 'scope', name: 'Scope', dataType: 'json', description: 'Current OpenScout scope, search, and filter state' },
    ],
  },

  slots: {
    Content: OpenScoutContent,
    LeftPanel: OpenScoutLeftPanel,
    Inspector: OpenScoutInspector,
  },

  hooks: {
    useCommands: useOpenScoutCommands,
    useStatus: useOpenScoutStatus,
    useSearch: useOpenScoutSearch,
    usePortOutput: useOpenScoutPortOutput,
    useLayoutMode: () => 'panel' as const,
  },
};
