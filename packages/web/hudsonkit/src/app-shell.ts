// Narrow subpath — the default Hudson shell that renders a single HudsonApp
// with full chrome. Intended for consumers who want just the AppShell entry
// without pulling in the full chrome/overlays/canvas/windows barrel.
export { AppShell } from './components/AppShell';
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
