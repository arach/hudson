import type { HudsonApp } from '../../index';
import { WebFetchProvider } from './WebFetchProvider';
import { WebFetchContent } from './WebFetchContent';
import { useWebFetchPortOutput } from './ports';

export const webFetchApp: HudsonApp = {
  id: 'web-fetch',
  name: 'Fetch',
  description: 'Fetch images from the web for piping to other apps',
  mode: 'panel',

  Provider: WebFetchProvider,

  ports: {
    outputs: [
      { id: 'image', name: 'Image', dataType: 'image', description: 'Fetched image as data URL' },
    ],
  },

  slots: {
    Content: WebFetchContent,
  },

  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: 'Fetch', color: 'neutral' }),
    usePortOutput: useWebFetchPortOutput,
  },
};
