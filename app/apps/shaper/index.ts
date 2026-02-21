import { createElement } from 'react';
import { PenTool, Layers, ScanSearch } from 'lucide-react';
import type { HudsonApp } from 'frame-ui';
import { ShaperProvider } from './ShaperProvider';
import { ShaperContent } from './ShaperContent';
import { ShaperLeftPanel } from './ShaperLeftPanel';
import { ShaperRightPanel } from './ShaperRightPanel';
import { ShaperLeftFooter } from './ShaperLeftFooter';
import { ShaperTerminal } from './ShaperTerminal';
import { ShaperHeaderActions } from './ShaperHeaderActions';
import {
  useShaperCommands,
  useShaperStatus,
  useShaperSearch,
  useShaperNavCenter,
  useShaperNavActions,
  useShaperFrameMode,
} from './hooks';

export const shaperApp: HudsonApp = {
  id: 'shaper',
  name: 'Shaper',
  description: 'Bezier curve editor for vector shapes',
  mode: 'panel',

  leftPanel: {
    title: 'Project',
    icon: createElement(Layers, { size: 12 }),
    headerActions: ShaperHeaderActions,
  },
  rightPanel: {
    title: 'Inspector',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  Provider: ShaperProvider,

  slots: {
    Content: ShaperContent,
    LeftPanel: ShaperLeftPanel,
    RightPanel: ShaperRightPanel,
    LeftFooter: ShaperLeftFooter,
    Terminal: ShaperTerminal,
  },

  hooks: {
    useCommands: useShaperCommands,
    useStatus: useShaperStatus,
    useSearch: useShaperSearch,
    useNavCenter: useShaperNavCenter,
    useNavActions: useShaperNavActions,
    useFrameMode: useShaperFrameMode,
  },
};
