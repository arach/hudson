import { createElement } from 'react';
import { ScanSearch } from '../../icons';
import type { HudsonApp } from '../../index';
import { JsonExplorerProvider } from './JsonExplorerProvider';
import { JsonExplorerContent } from './JsonExplorerContent';
import { JsonExplorerInspector } from './JsonExplorerInspector';
import {
  useJsonExplorerCommands,
  useJsonExplorerStatus,
  useJsonExplorerNavCenter,
  useJsonExplorerLayoutMode,
} from './hooks';
import { useJsonExplorerPortOutput, useJsonExplorerPortInput } from './ports';

export const jsonExplorerApp: HudsonApp = {
  id: 'json-explorer',
  name: 'JSON Explorer',
  description: 'Interactive tree viewer for structured JSON data with filtering and path inspection',
  mode: 'panel',

  Provider: JsonExplorerProvider,

  rightPanel: {
    title: 'Inspector',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  ports: {
    outputs: [
      { id: 'json', name: 'Full JSON', dataType: 'json', description: 'The complete parsed JSON data' },
      { id: 'selected', name: 'Selected Node', dataType: 'json', description: 'Value of the currently selected node' },
    ],
    inputs: [
      { id: 'json', name: 'JSON Data', dataType: 'json', description: 'Load JSON data into the explorer' },
    ],
  },

  slots: {
    Content: JsonExplorerContent,
    Inspector: JsonExplorerInspector,
  },

  hooks: {
    useCommands: useJsonExplorerCommands,
    useStatus: useJsonExplorerStatus,
    useNavCenter: useJsonExplorerNavCenter,
    useLayoutMode: useJsonExplorerLayoutMode,
    usePortOutput: useJsonExplorerPortOutput,
    usePortInput: useJsonExplorerPortInput,
  },
};
