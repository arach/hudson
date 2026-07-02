import { createElement } from 'react';
import { Sparkles, Radar } from 'lucide-react';
import type { HudsonApp, AppManifest } from 'hudsonkit';
import { HudsonAIProvider } from './HudsonAIProvider';
import { HudsonAIContent } from './HudsonAIContent';
import { HudsonAILeftPanel } from './HudsonAILeftPanel';
import { HudsonAIInspector } from './HudsonAIInspector';
import { hudsonAISettings } from './settings';
import { useHudsonAICommands, useHudsonAIStatus } from './hooks';

const hudsonAIManifest: AppManifest = {
  id: 'hudson-ai',
  name: 'Hudson AI',
  description: 'Workspace AI capability map, prompt library, and runtime introspection',
  mode: 'panel',
  commands: [],
};

export const hudsonAIApp: HudsonApp = {
  id: 'hudson-ai',
  name: 'Hudson AI',
  description: 'Capability explorer for Hudson AI prompts, tools, and workspace reach',
  mode: 'panel',
  manifest: hudsonAIManifest,
  settings: hudsonAISettings,

  leftPanel: {
    title: 'Library',
    icon: createElement(Sparkles, { size: 12 }),
  },
  rightPanel: {
    title: 'Capabilities',
    icon: createElement(Radar, { size: 12 }),
  },

  Provider: HudsonAIProvider,

  slots: {
    Content: HudsonAIContent,
    LeftPanel: HudsonAILeftPanel,
    Inspector: HudsonAIInspector,
  },

  hooks: {
    useCommands: useHudsonAICommands,
    useStatus: useHudsonAIStatus,
    useLayoutMode: () => 'panel' as const,
  },
};
