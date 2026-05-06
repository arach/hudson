import { createElement } from 'react';
import { ImageIcon, PanelLeft, ScanSearch } from 'lucide-react';
import type { HudsonApp } from 'hudsonkit';
import { ImageProcessProvider } from './ImageProcessProvider';
import { ImageProcessContent } from './ImageProcessContent';
import { ImageProcessLeftPanel } from './ImageProcessLeftPanel';
import { ImageProcessInspector } from './ImageProcessInspector';
import {
  useImageProcessCommands,
  useImageProcessLayoutMode,
  useImageProcessNavCenter,
  useImageProcessStatus,
} from './hooks';
import { useImageProcessPortInput, useImageProcessPortOutput } from './ports';

export const imageProcessLabApp: HudsonApp = {
  id: 'image-process-lab',
  name: 'Image Process',
  description: 'Visual processing lab for hero images, headers, and reusable export recipes',
  mode: 'panel',
  icon: createElement(ImageIcon, { size: 14 }),
  portInspector: 'hidden',

  Provider: ImageProcessProvider,

  leftPanel: {
    title: 'Image Process',
    icon: createElement(PanelLeft, { size: 12 }),
  },

  rightPanel: {
    title: 'Recipe',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  ports: {
    inputs: [
      { id: 'image', name: 'Source Image', dataType: 'image', description: 'Image data URL or browser-readable URL' },
    ],
    outputs: [
      { id: 'image', name: 'Processed Image', dataType: 'image', description: 'Processed PNG data URL' },
      { id: 'manifest', name: 'Manifest', dataType: 'json', description: 'Processing metadata and output details' },
      { id: 'recipe', name: 'Recipe', dataType: 'json', description: 'Reusable program parameters' },
    ],
  },

  slots: {
    Content: ImageProcessContent,
    LeftPanel: ImageProcessLeftPanel,
    Inspector: ImageProcessInspector,
  },

  hooks: {
    useCommands: useImageProcessCommands,
    useStatus: useImageProcessStatus,
    useNavCenter: useImageProcessNavCenter,
    useLayoutMode: useImageProcessLayoutMode,
    usePortOutput: useImageProcessPortOutput,
    usePortInput: useImageProcessPortInput,
  },
};
