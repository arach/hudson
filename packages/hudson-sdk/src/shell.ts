// Shell-internal entry point — components and tokens used only by the shell layer.
// App code should import from '@hudson/sdk' instead.

// Chrome components
export { Frame, Minimap, NavigationBar, SidePanel, StatusBar, CommandDock } from './components/chrome';

// Canvas
export { Canvas } from './components/canvas';

// Overlays
export { TerminalDrawer, CommandPalette, HudsonContextMenu } from './components/overlays';

// Windows
export { AppWindow } from './components/windows';

// Design tokens
export { SHELL_THEME, CHROME, CHROME_BASE, PANEL_STYLES, EDGE_EFFECTS, Z_LAYERS, LAYOUT } from './lib/theme';
