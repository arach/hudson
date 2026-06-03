import type { AppIntent } from 'hudsonkit';

export const vantageIntents: AppIntent[] = [
  {
    commandId: 'vantage:refresh',
    title: 'Refresh Vantage Status',
    description: 'Probe the native Hudson app and reload workspace node summaries.',
    category: 'view',
    keywords: ['vantage', 'status', 'refresh', 'companion', 'workspace'],
  },
  {
    commandId: 'vantage:launch-companion',
    title: 'Launch Hudson App',
    description: 'Start the native macOS Hudson app from Hudson Web.',
    category: 'workspace',
    keywords: ['vantage', 'launch', 'companion', 'menubar', 'native'],
  },
  {
    commandId: 'vantage:metrics',
    title: 'Fetch Vantage Metrics',
    description: 'Return lightweight performance and runtime counters from the Vantage control plane.',
    category: 'view',
    keywords: ['vantage', 'metrics', 'perf', 'runtime', 'control'],
  },
  {
    commandId: 'vantage:viewport-fit',
    title: 'Fit Vantage Viewport',
    description: 'Ask the native canvas to fit all visible nodes into the current viewport.',
    category: 'view',
    keywords: ['vantage', 'viewport', 'fit', 'canvas', 'zoom'],
  },
  {
    commandId: 'vantage:focus-selected',
    title: 'Focus Selected Node',
    description: 'Center the native Vantage canvas on the currently selected node.',
    category: 'navigation',
    keywords: ['vantage', 'focus', 'select', 'node', 'center'],
  },
];
