// Narrow subpath — Hudson app shells for single-app and multi-app cases,
// plus the createEmbedApp factory for wrapping plain React components as
// HudsonApp configs ready for WorkspaceShell.
export { AppShell } from './components/AppShell';
export { WorkspaceShell } from './components/WorkspaceShell';
export type { WorkspaceShellProps } from './components/WorkspaceShell';
export { createEmbedApp } from './lib/createEmbedApp';
export type { EmbedAppOptions } from './lib/createEmbedApp';
