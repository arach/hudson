import { createElement } from 'react';
import { Layers } from 'lucide-react';
import type { HudsonApp } from 'hudsonkit';
import { StageDesignProvider } from './StageDesignProvider';
import { StageDesignContent } from './StageDesignContent';
import { StageDesignLeftPanel } from './StageDesignLeftPanel';
import { StageDesignHeaderActions, StageDesignNavCenter } from './StageDesignChrome';
import {
  useStageDesignCommands,
  useStageDesignStatus,
  useStageDesignNavCenter,
  useStageDesignNavActions,
  useStageDesignLayoutMode,
} from './hooks';

export const stageDesignApp: HudsonApp = {
  id: 'stage-design',
  name: 'Stage Design',
  description: 'Place text, images, and embeds on the workspace canvas',
  mode: 'panel',
  icon: createElement(Layers, { size: 12 }),

  Provider: StageDesignProvider,

  leftPanel: {
    title: 'Stage',
    icon: createElement(Layers, { size: 12 }),
  },

  slots: {
    Content: StageDesignContent,
    LeftPanel: StageDesignLeftPanel,
  },

  hooks: {
    useCommands: useStageDesignCommands,
    useStatus: useStageDesignStatus,
    useNavCenter: useStageDesignNavCenter,
    useNavActions: useStageDesignNavActions,
    useLayoutMode: useStageDesignLayoutMode,
  },
};

export { StageDesignHeaderActions, StageDesignNavCenter };
