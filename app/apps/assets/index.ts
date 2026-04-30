import type { HudsonApp } from 'hudsonkit';
import { AssetsProvider } from './AssetsProvider';
import { AssetsContent } from './AssetsContent';
import { useAssetsPortOutput } from './ports';

export const assetsApp: HudsonApp = {
  id: 'assets',
  name: 'Assets',
  description: 'Media library — drop, paste, or fetch images from the web',
  mode: 'panel',

  Provider: AssetsProvider,

  ports: {
    outputs: [
      { id: 'image', name: 'Image', dataType: 'image', description: 'Selected asset as data URL' },
    ],
  },

  slots: {
    Content: AssetsContent,
  },

  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: 'Assets', color: 'neutral' }),
    usePortOutput: useAssetsPortOutput,
  },
};
