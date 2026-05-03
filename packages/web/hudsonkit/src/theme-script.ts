// Server-safe subpath — pure script string + a script-only React component
// with zero React-context or client-only imports. Safe to import from
// React Server Component layouts (e.g. Next.js app/layout.tsx).
export { getHudsonThemeScript, DEFAULT_THEME_STORAGE_KEY, DEFAULT_THEME, DEFAULT_TEMPLATE } from './theme/script';
export type { ThemeScriptOptions } from './theme/script';
export { HudsonThemeScript } from './theme/HudsonThemeScript';
