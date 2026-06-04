// Narrow subpath — Hudson app shells for single-app and multi-app cases,
// plus the createEmbedApp factory for wrapping plain React components as
// HudsonApp configs ready for the minimal EmbedShell.
export { AppShell } from './components/AppShell';
export { EmbedShell } from './components/EmbedShell';
export type { EmbedShellProps } from './components/EmbedShell';
export { createEmbedApp } from './lib/createEmbedApp';
export type { EmbedAppOptions } from './lib/createEmbedApp';
export type { AppShellChromeOptions } from './components/AppShell';

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
