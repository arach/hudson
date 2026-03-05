import type { AppIntent } from '@hudson/sdk';

export const shaperIntents: AppIntent[] = [
  // --- Tools ---
  {
    commandId: 'shaper:select-tool',
    title: 'Switch to Select Tool',
    description: 'Activate the selection tool for picking and moving anchor points on the canvas.',
    category: 'tool',
    keywords: ['select', 'pointer', 'cursor', 'pick', 'arrow', 'move tool'],
    shortcut: 'V',
  },
  {
    commandId: 'shaper:pen-tool',
    title: 'Switch to Pen Tool',
    description: 'Activate the pen tool for drawing new bezier curve anchor points.',
    category: 'tool',
    keywords: ['pen', 'draw', 'bezier', 'add point', 'create', 'path tool'],
    shortcut: 'P',
  },
  {
    commandId: 'shaper:hand-tool',
    title: 'Switch to Hand Tool',
    description: 'Activate the hand tool for panning around the canvas without moving points.',
    category: 'tool',
    keywords: ['hand', 'pan', 'grab', 'drag canvas', 'scroll', 'move canvas'],
    shortcut: 'H',
  },

  // --- Edit ---
  {
    commandId: 'shaper:undo',
    title: 'Undo',
    description: 'Undo the last editing action in the bezier editor.',
    category: 'edit',
    keywords: ['undo', 'revert', 'go back', 'ctrl z', 'step back'],
    shortcut: 'Cmd+Z',
  },
  {
    commandId: 'shaper:redo',
    title: 'Redo',
    description: 'Redo a previously undone editing action.',
    category: 'edit',
    keywords: ['redo', 'redo action', 'step forward', 'repeat'],
    shortcut: 'Cmd+Shift+Z',
  },
  {
    commandId: 'shaper:delete-point',
    title: 'Delete Selected Point',
    description: 'Remove the currently selected anchor point from the path.',
    category: 'edit',
    keywords: ['delete', 'remove point', 'erase', 'backspace', 'remove anchor'],
    shortcut: 'Backspace',
  },

  // --- File ---
  {
    commandId: 'shaper:save',
    title: 'Save Project',
    description: 'Save the current bezier project to local storage.',
    category: 'file',
    keywords: ['save', 'store', 'persist', 'quick save', 'write'],
    shortcut: 'Cmd+S',
  },
  {
    commandId: 'shaper:export',
    title: 'Export JSON',
    description: 'Download the current project as a JSON file.',
    category: 'file',
    keywords: ['export', 'download', 'json', 'save as', 'file download'],
  },
  {
    commandId: 'shaper:new-project',
    title: 'New Project',
    description: 'Start a new bezier project. The current project is saved automatically.',
    category: 'file',
    keywords: ['new', 'fresh', 'blank', 'start over', 'create project', 'reset project'],
  },
  {
    commandId: 'shaper:retrace',
    title: 'Re-trace from Silhouette',
    description: 'Automatically generate bezier curves by tracing the loaded silhouette image.',
    category: 'file',
    keywords: ['retrace', 'trace', 'auto trace', 'silhouette', 'generate path', 'vectorize'],
  },

  // --- Navigation ---
  {
    commandId: 'shaper:reset-zoom',
    title: 'Reset Zoom',
    description: 'Reset the canvas zoom level back to 100%.',
    category: 'navigation',
    keywords: ['reset zoom', 'zoom reset', 'default zoom', '100%', 'actual size'],
    shortcut: '0',
  },
  {
    commandId: 'shaper:zoom-in',
    title: 'Zoom In',
    description: 'Increase the canvas zoom level to see more detail.',
    category: 'navigation',
    keywords: ['zoom in', 'magnify', 'enlarge', 'closer', 'increase zoom'],
    shortcut: '+',
  },
  {
    commandId: 'shaper:zoom-out',
    title: 'Zoom Out',
    description: 'Decrease the canvas zoom level to see more of the canvas.',
    category: 'navigation',
    keywords: ['zoom out', 'shrink', 'smaller', 'further', 'decrease zoom'],
    shortcut: '-',
  },
  {
    commandId: 'shaper:focus-point',
    title: 'Focus on Selected Point',
    description: 'Pan and zoom the canvas to center on the currently selected anchor point.',
    category: 'navigation',
    keywords: ['focus', 'center on point', 'go to point', 'find point', 'jump to selection'],
  },

  // --- View ---
  {
    commandId: 'shaper:toggle-path',
    title: 'Toggle Bezier Path',
    description: 'Show or hide the rendered bezier curve path on the canvas.',
    category: 'view',
    keywords: ['path', 'bezier', 'curve', 'show path', 'hide path', 'stroke'],
  },
  {
    commandId: 'shaper:toggle-anchors',
    title: 'Toggle Anchors',
    description: 'Show or hide the anchor point indicators on the path.',
    category: 'view',
    keywords: ['anchors', 'points', 'nodes', 'show anchors', 'hide anchors', 'vertices'],
  },
  {
    commandId: 'shaper:toggle-handles',
    title: 'Toggle Handles',
    description: 'Show or hide the bezier control handles extending from anchor points.',
    category: 'view',
    keywords: ['handles', 'control points', 'tangents', 'bezier handles', 'show handles'],
  },
  {
    commandId: 'shaper:toggle-labels',
    title: 'Toggle Labels',
    description: 'Show or hide coordinate labels next to anchor points.',
    category: 'view',
    keywords: ['labels', 'coordinates', 'text', 'show labels', 'annotations', 'numbers'],
  },
  {
    commandId: 'shaper:toggle-original',
    title: 'Toggle Original Image',
    description: 'Show or hide the original reference image behind the bezier path.',
    category: 'view',
    keywords: ['original', 'reference', 'background image', 'source image', 'show original'],
  },
  {
    commandId: 'shaper:toggle-silhouette',
    title: 'Toggle Silhouette',
    description: 'Show or hide the silhouette overlay used for tracing.',
    category: 'view',
    keywords: ['silhouette', 'outline', 'shadow', 'trace overlay', 'show silhouette'],
  },
  {
    commandId: 'shaper:toggle-grid',
    title: 'Toggle Grid',
    description: 'Show or hide the background grid on the canvas.',
    category: 'view',
    keywords: ['grid', 'gridlines', 'snap grid', 'show grid', 'background grid'],
  },
  {
    commandId: 'shaper:toggle-guides',
    title: 'Toggle Guides',
    description: 'Show or hide alignment guides on the canvas.',
    category: 'view',
    keywords: ['guides', 'alignment', 'rulers', 'snap guides', 'show guides'],
  },

  // --- Toggle ---
  {
    commandId: 'shaper:toggle-animation',
    title: 'Toggle Animation Mode',
    description: 'Enable or disable animation mode for previewing path animations.',
    category: 'toggle',
    keywords: ['animation', 'animate', 'motion', 'preview animation', 'playback'],
    shortcut: 'T',
  },
];
