import type { AppIntent } from 'hudsonkit';

export const docsIntents: AppIntent[] = [
  {
    commandId: 'view-canvas',
    title: 'Switch to Canvas View',
    description: 'Display documentation components in a free-form canvas layout with pan and zoom.',
    category: 'view',
    keywords: ['canvas', 'spatial', 'free layout', 'pan view', 'canvas mode'],
    shortcut: 'Cmd+1',
  },
  {
    commandId: 'view-list',
    title: 'Switch to List View',
    description: 'Display documentation components in a vertical scrollable list.',
    category: 'view',
    keywords: ['list', 'vertical', 'scroll', 'list mode', 'linear'],
    shortcut: 'Cmd+2',
  },
  {
    commandId: 'view-tiles',
    title: 'Switch to Tiles View',
    description: 'Display documentation components as a grid of tiles.',
    category: 'view',
    keywords: ['tiles', 'grid', 'cards', 'tile mode', 'gallery'],
    shortcut: 'Cmd+3',
  },
];
