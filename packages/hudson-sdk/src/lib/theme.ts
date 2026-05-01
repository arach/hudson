/**
 * Shell Theme — consolidated design tokens for Hudson chrome.
 */

// Chrome shadows are theme-aware via CSS custom properties defined in
// packages/hudson-sdk/src/styles/tokens.css. Dark mode keeps the original
// deep rim glow; light mode uses short, low-opacity drop shadows so panels
// feel like paper lifted above the canvas instead of cut-outs with a halo.
const tokens = {
  blur: 'backdrop-blur-xl',
  bg: 'bg-background/95',
  border: 'border border-[var(--hud-chrome-border)]',
  shadow: 'shadow-[var(--hud-shadow-panel)]',
  topHighlight: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent',
} as const;

const base = `${tokens.bg} ${tokens.blur} ${tokens.border} ${tokens.shadow}`;

export const SHELL_THEME = {
  tokens,
  base,

  panels: {
    navigationStack: `fixed top-0 left-0 right-0 z-50`,
    manifest: `${base} fixed top-[48px] left-0 bottom-[28px] w-[280px] z-40 rounded-none border-l-0 border-t-0 overflow-hidden`,
    inspector: `${base} fixed top-[48px] right-0 bottom-[28px] w-[280px] z-40 rounded-none border-r-0 border-t-0 overflow-hidden`,
    minimap: `bg-card/95 backdrop-blur-xl border border-[var(--hud-chrome-border)] shadow-[var(--hud-shadow-minimap)] fixed left-0 bottom-[28px] z-[45] rounded-none border-l-0 border-b-0 overflow-hidden`,
    statusBar: `bg-card/95 backdrop-blur-xl border-t border-[var(--hud-chrome-border)] shadow-[var(--hud-shadow-bar)] fixed bottom-0 left-0 right-0 z-[60]`,
    commandDock: `bg-card/95 backdrop-blur-xl border-t border-l border-[var(--hud-chrome-border)] fixed right-0 bottom-[28px] w-[280px] z-[45] rounded-none overflow-hidden`,
  },

  effects: {
    rightFade: 'after:absolute after:top-0 after:right-0 after:bottom-0 after:w-4 after:bg-gradient-to-l after:from-transparent after:to-[var(--hud-edge-fade-dark)] after:pointer-events-none',
    leftFade: 'after:absolute after:top-0 after:left-0 after:bottom-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:to-[var(--hud-edge-fade-dark)] after:pointer-events-none',
    bottomGlow: 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-8 after:bg-gradient-to-t after:from-[var(--hud-edge-fade-bottom)] after:to-transparent after:pointer-events-none',
  },

  zIndex: {
    canvas: 0,
    worldContent: 10,
    panels: 40,
    minimap: 45,
    navigationStack: 50,
    statusBar: 60,
    drawer: 70,
    modals: 100,
  },

  layout: {
    navHeight: 48,
    panelWidth: 280,
    panelTopOffset: 48,
    statusBarHeight: 28,
    panelBottomOffset: 28,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Semantic tokens
// ─────────────────────────────────────────────────────────────────────────
// These are CSS custom properties that apps can read via var(--hud-*) or
// override on a Provider wrapper to theme their content area. The chrome
// itself keeps its dark Tailwind utilities (see SHELL_THEME.tokens above);
// these tokens are the knobs for *app content*.
//
// Defaults are emitted at :root by the SDK's compiled styles bundle
// (packages/hudson-sdk/src/styles/bundle.css → dist/styles.css). Apps
// override by setting the vars on a wrapping element, e.g.:
//
//   <div style={{
//     '--hud-bg': '#F9F9F8',
//     '--hud-ink': '#1C1C1A',
//     '--hud-accent': '#0066FF',
//   } as React.CSSProperties}>
//     {children}
//   </div>
//
// The full dark-baseline values live in bundle.css. The object below is
// exported for TypeScript consumers that want type-safe token keys.
export const SEMANTIC_TOKENS = {
  surface: ['--hud-bg', '--hud-surface'],
  text: ['--hud-ink', '--hud-muted', '--hud-dim'],
  structure: ['--hud-border', '--hud-radius', '--hud-shadow-soft'],
  accent: ['--hud-accent', '--hud-accent-soft'],
  status: ['--hud-status-ok', '--hud-status-warn', '--hud-status-error', '--hud-status-info'],
  fontFamily: ['--hud-font-sans', '--hud-font-mono', '--hud-font-serif'],
  textSize: [
    '--hud-text-xxs',
    '--hud-text-xs',
    '--hud-text-sm',
    '--hud-text-base',
    '--hud-text-md',
    '--hud-text-lg',
    '--hud-text-xl',
    '--hud-text-2xl',
    '--hud-text-3xl',
  ],
  leading: [
    '--hud-leading-tight',
    '--hud-leading-snug',
    '--hud-leading-normal',
    '--hud-leading-relaxed',
  ],
  tracking: [
    '--hud-tracking-tight',
    '--hud-tracking-normal',
    '--hud-tracking-wide',
    '--hud-tracking-wider',
    '--hud-tracking-widest',
  ],
  weight: [
    '--hud-weight-normal',
    '--hud-weight-medium',
    '--hud-weight-semibold',
    '--hud-weight-bold',
  ],
} as const;

export type HudSemanticToken =
  (typeof SEMANTIC_TOKENS)[keyof typeof SEMANTIC_TOKENS][number];

// Backward-compat re-exports (deprecated)
/** @deprecated Use SHELL_THEME.tokens */
export const CHROME = SHELL_THEME.tokens;
/** @deprecated Use SHELL_THEME.base */
export const CHROME_BASE = SHELL_THEME.base;
/** @deprecated Use SHELL_THEME.panels */
export const PANEL_STYLES = SHELL_THEME.panels;
/** @deprecated Use SHELL_THEME.effects */
export const EDGE_EFFECTS = SHELL_THEME.effects;
/** @deprecated Use SHELL_THEME.zIndex */
export const Z_LAYERS = SHELL_THEME.zIndex;
/** @deprecated Use SHELL_THEME.layout */
export const LAYOUT = SHELL_THEME.layout;
