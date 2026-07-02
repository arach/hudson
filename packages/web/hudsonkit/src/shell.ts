// Shell-internal entry point — components and tokens used only by the shell layer.
// App code should import from 'hudsonkit' instead.

// Chrome components
export { Frame, Minimap, NavigationBar, SidePanel, StatusBar, CommandDock } from './components/chrome';

// Canvas
export { Canvas } from './components/canvas';

// Overlays
export { TerminalDrawer, CommandPalette, HudsonContextMenu } from './components/overlays';

// Windows
export { AppWindow } from './components/windows';

// App shell (default — renders a single HudsonApp with full chrome)
export { AppShell } from './components/AppShell';
export type { AppShellChromeOptions, AppShellEnvironment } from './components/AppShell';
export type { HudsonHostRoutes } from './workspace/hostRoutes';

// Design tokens
export { SHELL_THEME, CHROME, CHROME_BASE, PANEL_STYLES, EDGE_EFFECTS, Z_LAYERS, LAYOUT } from './lib/theme';
