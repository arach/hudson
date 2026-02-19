/**
 * Frame Chrome Style Constants
 * Unified visual treatment for all chrome panels.
 */

export const CHROME = {
  blur: 'backdrop-blur-xl',
  bg: 'bg-black/95',
  border: 'border border-neutral-800/80',
  shadow: 'shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]',
  topHighlight: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
} as const;

export const CHROME_BASE = `${CHROME.bg} ${CHROME.blur} ${CHROME.border} ${CHROME.shadow}`;

export const PANEL_STYLES = {
  navigationStack: `fixed top-0 left-0 right-0 z-50`,
  manifest: `${CHROME_BASE} fixed top-[48px] left-0 bottom-[28px] w-[280px] z-40 rounded-none border-l-0 border-t-0 overflow-hidden`,
  inspector: `${CHROME_BASE} fixed top-[48px] right-0 bottom-[28px] w-[280px] z-40 rounded-none border-r-0 border-t-0 overflow-hidden`,
  minimap: `bg-black/90 backdrop-blur-xl border border-neutral-800/80 shadow-[0_0_20px_rgba(0,0,0,0.7)] fixed left-0 bottom-[28px] z-[45] rounded-none border-l-0 border-b-0 overflow-hidden`,
  statusBar: `bg-[#09090b]/95 backdrop-blur-xl border-t border-neutral-800 shadow-[0_-5px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.03)] fixed bottom-0 left-0 right-0 z-[60]`,
  commandDock: `bg-black/90 backdrop-blur-xl border-t border-l border-neutral-800/80 fixed right-0 bottom-[28px] w-[280px] z-[45] rounded-none overflow-hidden`,
} as const;

export const EDGE_EFFECTS = {
  rightFade: 'after:absolute after:top-0 after:right-0 after:bottom-0 after:w-4 after:bg-gradient-to-l after:from-transparent after:to-black/20 after:pointer-events-none',
  leftFade: 'after:absolute after:top-0 after:left-0 after:bottom-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:to-black/20 after:pointer-events-none',
  bottomGlow: 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-8 after:bg-gradient-to-t after:from-black/30 after:to-transparent after:pointer-events-none',
} as const;

export const Z_LAYERS = {
  canvas: 0,
  worldContent: 10,
  panels: 40,
  minimap: 45,
  navigationStack: 50,
  statusBar: 60,
  drawer: 70,
  modals: 100,
} as const;

export const LAYOUT = {
  navHeight: 48,
  panelWidth: 280,
  panelTopOffset: 48,
  statusBarHeight: 28,
  panelBottomOffset: 28,
} as const;
