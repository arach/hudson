import type { AppIntent } from 'hudsonkit';

export const vantageIntents: AppIntent[] = [
  {
    commandId: 'vantage:refresh',
    title: 'Refresh Native Console Status',
    description: 'Probe the native Hudson app and reload workspace node summaries.',
    category: 'view',
    keywords: ['native', 'status', 'refresh', 'companion', 'workspace'],
  },
  {
    commandId: 'vantage:launch-companion',
    title: 'Launch Hudson App',
    description: 'Start the native macOS Hudson app from Hudson Web.',
    category: 'workspace',
    keywords: ['native', 'launch', 'companion', 'menubar', 'workspace'],
  },
  {
    commandId: 'vantage:metrics',
    title: 'Fetch Native Workspace Metrics',
    description: 'Return lightweight performance and runtime counters from the native control plane.',
    category: 'view',
    keywords: ['native', 'metrics', 'perf', 'runtime', 'control'],
  },
  {
    commandId: 'vantage:viewport-fit',
    title: 'Fit Native Workspace Viewport',
    description: 'Ask the native canvas to fit all visible nodes into the current viewport.',
    category: 'view',
    keywords: ['native', 'viewport', 'fit', 'canvas', 'zoom'],
  },
  {
    commandId: 'vantage:focus-selected',
    title: 'Focus Selected Node',
    description: 'Center the native workspace canvas on the currently selected node.',
    category: 'navigation',
    keywords: ['native', 'focus', 'select', 'node', 'center'],
  },
];
