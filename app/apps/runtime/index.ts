import { createElement } from 'react';
import { ScanSearch } from 'lucide-react';
import type { AppManifest, HudsonApp } from 'hudsonkit';
import { RUNTIME_AGENT_GUIDE } from './agent-context';
import { RuntimeProvider } from './RuntimeProvider';
import { RuntimeContent } from './RuntimeContent';
import { RuntimeLeftPanel } from './RuntimeLeftPanel';
import { RuntimeInspector } from './RuntimeInspector';
import { RuntimeIcon } from './RuntimeIcon';
import {
  useRuntimeCommands,
  useRuntimeLayoutMode,
  useRuntimeNavCenter,
  useRuntimeSearch,
  useRuntimeStatus,
} from './hooks';
import { runtimeIntents } from './intents';
import { useRuntimePortOutput } from './ports';

const IS_DEV_ENV = process.env.NODE_ENV === 'development';

const runtimeManifest: AppManifest = {
  id: 'runtime',
  name: 'Runtime',
  description: 'Spatial runtime console for the native Runtime menubar companion',
  mode: 'panel',
  commands: [
    { id: 'runtime:refresh', label: 'Refresh Runtime Status' },
    { id: 'runtime:launch-companion', label: 'Launch Runtime Companion' },
    { id: 'runtime:metrics', label: 'Fetch Runtime Metrics' },
    { id: 'runtime:viewport-fit', label: 'Fit Runtime Viewport' },
    { id: 'runtime:focus-selected', label: 'Focus Selected Node' },
  ],
};

export const runtimeApp: HudsonApp = {
  id: 'runtime',
  name: 'Runtime',
  description: 'Spatial runtime console for tmux sessions, terminals, and native workspace nodes',
  agentContext: RUNTIME_AGENT_GUIDE,
  mode: 'panel',
  icon: createElement(RuntimeIcon, { size: 14, className: 'text-cyan-300' }),
  manifest: runtimeManifest,
  intents: runtimeIntents,
  backend: {},

  services: IS_DEV_ENV
    ? [{ serviceId: 'runtime-companion', optional: true, reason: 'Native macOS menubar canvas for tmux-backed runtime nodes' }]
    : [],

  leftPanel: {
    title: 'Navigator',
    icon: createElement(RuntimeIcon, { size: 12, className: 'text-cyan-300' }),
  },
  rightPanel: {
    title: 'Inspector',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  ports: {
    outputs: [
      { id: 'workspace-status', name: 'Workspace Status', dataType: 'json', description: 'Latest companion probe and workspace summary' },
      { id: 'nodes', name: 'Nodes', dataType: 'json', description: 'Node summaries returned by the Runtime control plane' },
      { id: 'selected-node', name: 'Selected Node', dataType: 'json', description: 'Currently selected runtime node' },
    ],
  },

  Provider: RuntimeProvider,

  slots: {
    Content: RuntimeContent,
    LeftPanel: RuntimeLeftPanel,
    Inspector: RuntimeInspector,
  },

  hooks: {
    useCommands: useRuntimeCommands,
    useStatus: useRuntimeStatus,
    useSearch: useRuntimeSearch,
    useNavCenter: useRuntimeNavCenter,
    useLayoutMode: useRuntimeLayoutMode,
    usePortOutput: useRuntimePortOutput,
  },
};
