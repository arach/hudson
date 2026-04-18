// Narrow subpath — overlay components (drawers, palettes) WITHOUT ContextMenu.
// Import '@hudson/sdk/context-menu' separately to opt in to the menu
// (which pulls `motion` + `@base-ui-components/react`).
export { default as TerminalDrawer } from './components/overlays/TerminalDrawer';
export { default as CommandPalette } from './components/overlays/CommandPalette';
export type { CommandOption } from './components/overlays/CommandPalette';
