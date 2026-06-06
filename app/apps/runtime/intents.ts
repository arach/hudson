import type { AppIntent } from 'hudsonkit';

export const runtimeIntents: AppIntent[] = [
  {
    commandId: 'runtime:refresh',
    title: 'Refresh Runtime Status',
    description: 'Probe the native Runtime companion and reload workspace node summaries.',
    category: 'view',
    keywords: ['runtime', 'status', 'refresh', 'companion', 'workspace'],
  },
  {
    commandId: 'runtime:launch-companion',
    title: 'Launch Hudson App',
    description: 'Start the native macOS Hudson app from the Runtime surface.',
    category: 'workspace',
    keywords: ['runtime', 'launch', 'hudson', 'native'],
  },
  {
    commandId: 'runtime:metrics',
    title: 'Fetch Runtime Metrics',
    description: 'Return lightweight performance and runtime counters from the Runtime control plane.',
    category: 'view',
    keywords: ['runtime', 'metrics', 'perf', 'runtime', 'control'],
  },
  {
    commandId: 'runtime:viewport-fit',
    title: 'Fit Runtime Viewport',
    description: 'Ask the native canvas to fit all visible nodes into the current viewport.',
    category: 'view',
    keywords: ['runtime', 'viewport', 'fit', 'canvas', 'zoom'],
  },
  {
    commandId: 'runtime:focus-selected',
    title: 'Focus Selected Node',
    description: 'Center the native Runtime canvas on the currently selected node.',
    category: 'navigation',
    keywords: ['runtime', 'focus', 'select', 'node', 'center'],
  },
];
