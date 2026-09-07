import { createElement } from 'react';
import { History } from 'lucide-react';
import type { HudsonApp } from '../../index';
import { ApiInspectorProvider } from './ApiInspectorProvider';
import { ApiInspectorContent } from './ApiInspectorContent';
import { ApiInspectorInspector } from './ApiInspectorInspector';
import {
  useApiInspectorCommands,
  useApiInspectorStatus,
  useApiInspectorNavCenter,
  useApiInspectorNavActions,
  useApiInspectorLayoutMode,
} from './hooks';
import { useApiInspectorPortOutput, useApiInspectorPortInput } from './ports';

export const apiInspectorApp: HudsonApp = {
  id: 'api-inspector',
  name: 'API Inspector',
  description: 'HTTP request playground — send requests, inspect responses, and pipe data to other apps',
  mode: 'panel',

  Provider: ApiInspectorProvider,

  rightPanel: {
    title: 'Inspector',
    icon: createElement(History, { size: 12 }),
  },

  ports: {
    outputs: [
      { id: 'response-json', name: 'Response JSON', dataType: 'json', description: 'Parsed JSON from the last response' },
      { id: 'response-body', name: 'Response Body', dataType: 'text', description: 'Raw response body text' },
    ],
    inputs: [
      { id: 'url', name: 'URL', dataType: 'text', description: 'Pre-fill the URL field' },
      { id: 'request', name: 'Request', dataType: 'json', description: 'Full request object with url and method' },
    ],
  },

  slots: {
    Content: ApiInspectorContent,
    Inspector: ApiInspectorInspector,
  },

  hooks: {
    useCommands: useApiInspectorCommands,
    useStatus: useApiInspectorStatus,
    useNavCenter: useApiInspectorNavCenter,
    useNavActions: useApiInspectorNavActions,
    useLayoutMode: useApiInspectorLayoutMode,
    usePortOutput: useApiInspectorPortOutput,
    usePortInput: useApiInspectorPortInput,
  },
};
