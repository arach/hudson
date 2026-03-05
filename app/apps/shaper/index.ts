import { createElement } from 'react';
import { PenTool, Layers, ScanSearch, Anchor, Paintbrush, Play, Palette } from 'lucide-react';
import type { HudsonApp, AppTool, AppManifest } from '@hudson/sdk';
import { ShaperProvider } from './ShaperProvider';
import { ShaperContent } from './ShaperContent';
import { ShaperLeftPanel } from './ShaperLeftPanel';
import { ShaperInspector } from './ShaperInspector';
import { ShaperLeftFooter } from './ShaperLeftFooter';
import { ShaperTerminal } from './ShaperTerminal';
import { ShaperHeaderActions } from './ShaperHeaderActions';
import { AnchorsTool } from './tools/AnchorsTool';
import { FillTool } from './tools/FillTool';
import { AnimationTool } from './tools/AnimationTool';
import { AppearanceTool } from './tools/AppearanceTool';

import {
  useShaperCommands,
  useShaperStatus,
  useShaperSearch,
  useShaperNavCenter,
  useShaperNavActions,
  useShaperLayoutMode,
  useShaperActiveToolHint,
} from './hooks';
import { shaperIntents } from './intents';

const shaperTools: AppTool[] = [
  { id: 'anchors', name: 'Anchors', icon: createElement(Anchor, { size: 12 }), Component: AnchorsTool },
  { id: 'fill', name: 'Fill', icon: createElement(Paintbrush, { size: 12 }), Component: FillTool },
  { id: 'animation', name: 'Animation', icon: createElement(Play, { size: 12 }), Component: AnimationTool },
  { id: 'appearance', name: 'Appearance', icon: createElement(Palette, { size: 12 }), Component: AppearanceTool },
];

const shaperManifest: AppManifest = {
  id: 'shaper',
  name: 'Shaper',
  description: 'Bezier curve editor for vector shapes',
  mode: 'panel',
  commands: [
    { id: 'shaper:select-tool', label: 'Tool: Select', shortcut: 'V' },
    { id: 'shaper:pen-tool', label: 'Tool: Pen', shortcut: 'P' },
    { id: 'shaper:hand-tool', label: 'Tool: Hand', shortcut: 'H' },
    { id: 'shaper:undo', label: 'Undo', shortcut: 'Cmd+Z' },
    { id: 'shaper:redo', label: 'Redo', shortcut: 'Cmd+Shift+Z' },
    { id: 'shaper:save', label: 'Save', shortcut: 'Cmd+S' },
    { id: 'shaper:export', label: 'Export JSON' },
    { id: 'shaper:new-project', label: 'New Project' },
  ],
  tools: [
    { id: 'anchors', name: 'Anchors' },
    { id: 'fill', name: 'Fill' },
    { id: 'animation', name: 'Animation' },
    { id: 'appearance', name: 'Appearance' },
  ],
};

export const shaperApp: HudsonApp = {
  id: 'shaper',
  name: 'Shaper',
  description: 'Bezier curve editor for vector shapes',
  mode: 'panel',
  manifest: shaperManifest,
  intents: shaperIntents,

  leftPanel: {
    title: 'Project',
    icon: createElement(Layers, { size: 12 }),
    headerActions: ShaperHeaderActions,
  },
  rightPanel: {
    title: 'Inspector',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  tools: shaperTools,

  Provider: ShaperProvider,

  slots: {
    Content: ShaperContent,
    LeftPanel: ShaperLeftPanel,
    Inspector: ShaperInspector,
    LeftFooter: ShaperLeftFooter,
    Terminal: ShaperTerminal,
  },

  hooks: {
    useCommands: useShaperCommands,
    useStatus: useShaperStatus,
    useSearch: useShaperSearch,
    useNavCenter: useShaperNavCenter,
    useNavActions: useShaperNavActions,
    useLayoutMode: useShaperLayoutMode,
    useActiveToolHint: useShaperActiveToolHint,
  },
};
