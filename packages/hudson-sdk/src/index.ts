// @hudson/sdk — public API for app developers.
// Shell internals are in '@hudson/sdk/shell'.

// Types
export type { HudsonApp, AppTool, StatusColor, SearchConfig, AppManifest } from './types/app';
export type { HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation } from './types/workspace';
export type { AppIntent, IntentCategory, IntentParameter, CatalogAppEntry, IntentCatalog } from './types/intent';
export type { CommandOption, ContextMenuEntry, ContextMenuAction, ContextMenuSeparator, ContextMenuGroup } from './components/overlays';

// Hooks
export { usePersistentState } from './hooks/usePersistentState';

// Utilities
export * from './lib/sounds';
export { logEvent, FRAME_LOG_EVENT } from './lib/logger';
export type { FrameLogEntry } from './lib/logger';
export { worldToScreen, screenToWorld } from './lib/viewport';

// Manifest
export { deriveManifest } from './lib/manifest';

// Platform adapter
export type { PlatformAdapter, PlatformLayout } from './platform';
export { WEB_ADAPTER, PlatformProvider, usePlatform, usePlatformLayout } from './platform';

// Reusable widget (used by apps like Shaper directly)
export { ZoomControls } from './components/chrome';
