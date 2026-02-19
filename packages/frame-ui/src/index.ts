// Chrome (structural shell)
export { Frame, Minimap, NavigationBar, SidePanel, StatusBar, CommandDock, ZoomControls } from './components/chrome';

// Canvas (pan/zoom engine)
export { Canvas } from './components/canvas';

// Overlays (modals/drawers)
export { TerminalDrawer, CommandPalette } from './components/overlays';
export type { CommandOption } from './components/overlays';

// Design tokens
export { CHROME, CHROME_BASE, PANEL_STYLES, EDGE_EFFECTS, Z_LAYERS, LAYOUT } from './lib/chrome';

// Utilities
export * from './lib/sounds';
export { logEvent, FRAME_LOG_EVENT } from './lib/logger';
export type { FrameLogEntry } from './lib/logger';

// Hooks
export { usePersistentState } from './hooks/usePersistentState';
