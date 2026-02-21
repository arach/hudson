// Chrome (structural shell)
export { Frame, Minimap, NavigationBar, SidePanel, StatusBar, CommandDock, ZoomControls } from './components/chrome';

// Canvas (pan/zoom engine)
export { Canvas } from './components/canvas';

// Overlays (modals/drawers)
export { TerminalDrawer, CommandPalette, HudsonContextMenu } from './components/overlays';
export type { CommandOption, ContextMenuEntry, ContextMenuAction, ContextMenuSeparator, ContextMenuGroup } from './components/overlays';

// Design tokens
export { CHROME, CHROME_BASE, PANEL_STYLES, EDGE_EFFECTS, Z_LAYERS, LAYOUT } from './lib/chrome';

// Utilities
export * from './lib/sounds';
export { logEvent, FRAME_LOG_EVENT } from './lib/logger';
export type { FrameLogEntry } from './lib/logger';
export { worldToScreen, screenToWorld } from './lib/viewport';

// Types
export type { HudsonApp, StatusColor, SearchConfig } from './types/app';
export type { HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation } from './types/workspace';

// Windows
export { AppWindow } from './components/windows';

// Hooks
export { usePersistentState } from './hooks/usePersistentState';
