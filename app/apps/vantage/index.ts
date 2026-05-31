import { createElement } from 'react';
import { ScanSearch } from 'lucide-react';
import type { AppManifest, HudsonApp } from 'hudsonkit';
import { VANTAGE_AGENT_GUIDE } from './agent-context';
import { VantageProvider } from './VantageProvider';
import { VantageContent } from './VantageContent';
import { VantageLeftPanel } from './VantageLeftPanel';
import { VantageInspector } from './VantageInspector';
import { VantageIcon } from './VantageIcon';
import {
  useVantageCommands,
  useVantageLayoutMode,
  useVantageNavCenter,
  useVantageSearch,
  useVantageStatus,
} from './hooks';
import { vantageIntents } from './intents';
import { useVantagePortOutput } from './ports';

const IS_DEV_ENV = process.env.NODE_ENV === 'development';

const vantageManifest: AppManifest = {
  id: 'vantage',
  name: 'Vantage',
  description: 'Spatial runtime console for the native Vantage menubar companion',
  mode: 'panel',
  commands: [
    { id: 'vantage:refresh', label: 'Refresh Vantage Status' },
    { id: 'vantage:launch-companion', label: 'Launch Vantage Companion' },
    { id: 'vantage:metrics', label: 'Fetch Vantage Metrics' },
    { id: 'vantage:viewport-fit', label: 'Fit Vantage Viewport' },
    { id: 'vantage:focus-selected', label: 'Focus Selected Node' },
  ],
};

export const vantageApp: HudsonApp = {
  id: 'vantage',
  name: 'Vantage',
  description: 'Spatial runtime console for tmux sessions, terminals, and native workspace nodes',
  agentContext: VANTAGE_AGENT_GUIDE,
  mode: 'panel',
  icon: createElement(VantageIcon, { size: 14, className: 'text-cyan-300' }),
  manifest: vantageManifest,
  intents: vantageIntents,
  backend: {},

  services: IS_DEV_ENV
    ? [{ serviceId: 'vantage-companion', optional: true, reason: 'Native macOS menubar canvas for tmux-backed runtime nodes' }]
    : [],

  leftPanel: {
    title: 'Navigator',
    icon: createElement(VantageIcon, { size: 12, className: 'text-cyan-300' }),
  },
  rightPanel: {
    title: 'Inspector',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  ports: {
    outputs: [
      { id: 'workspace-status', name: 'Workspace Status', dataType: 'json', description: 'Latest companion probe and workspace summary' },
      { id: 'nodes', name: 'Nodes', dataType: 'json', description: 'Node summaries returned by the Vantage control plane' },
      { id: 'selected-node', name: 'Selected Node', dataType: 'json', description: 'Currently selected runtime node' },
    ],
  },

  Provider: VantageProvider,

  slots: {
    Content: VantageContent,
    LeftPanel: VantageLeftPanel,
    Inspector: VantageInspector,
  },

  hooks: {
    useCommands: useVantageCommands,
    useStatus: useVantageStatus,
    useSearch: useVantageSearch,
    useNavCenter: useVantageNavCenter,
    useLayoutMode: useVantageLayoutMode,
    usePortOutput: useVantagePortOutput,
  },
};
