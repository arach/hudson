// Narrow subpath — Hudson's single-app shell plus the createEmbedApp factory
// for wrapping plain React components as HudsonApp configs.
export { AppShell } from './components/AppShell';
export { createEmbedApp } from './lib/createEmbedApp';
export type { EmbedAppOptions } from './lib/createEmbedApp';
export type { AppShellChromeOptions, AppShellEnvironment } from './components/AppShell';

// Host route map consumed by server-backed shell features (Assistant chat,
// speech, voice). Pass via <AppShell environment={{ routes }}>; read with
// useWorkspaceHostRoutes() from any component inside the shell.
export { useWorkspaceHostRoutes } from './workspace/hostRoutes';
export type { HudsonHostRoutes } from './workspace/hostRoutes';

// Imperative handles for the drawer / palette / side panels. Callable from
// any component rendered inside an <AppShell>. See AppShellControlsContext
// for the contract (no-ops when the matching chrome feature is disabled).
export {
  useAppShellDrawer,
  useAppShellPalette,
  useAppShellSidePanels,
} from './context/AppShellControlsContext';
export type {
  DrawerControls,
  DrawerTab,
  PaletteControls,
  SidePanelControls,
} from './context/AppShellControlsContext';
