'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_TEMPLATE,
  DEFAULT_THEME,
  DEFAULT_THEME_STORAGE_KEY,
} from './script';

export type HudsonTheme = 'light' | 'dark' | 'system';
export type HudsonTemplate = 'hudson' | 'editorial';

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: HudsonTheme;
  defaultTemplate?: HudsonTemplate;
  storageKey?: string;
  rootElement?: HTMLElement | null;
}

interface ThemeContextValue {
  theme: HudsonTheme;
  // Undefined during SSR and the first client render. Components that render
  // theme-dependent attributes should omit them while undefined and rely on
  // HudsonThemeScript's pre-hydration script to set initial document state.
  resolvedTheme: 'light' | 'dark' | undefined;
  template: HudsonTemplate;
  setTheme: (theme: HudsonTheme) => void;
  setTemplate: (template: HudsonTemplate) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface StoredThemeState {
  theme?: HudsonTheme;
  template?: HudsonTemplate;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// URL query params (?theme=...&template=...) are a per-request override used
// by embedded iframes (e.g. /preview on the landing page) that need a
// predictable paint regardless of the visitor's stored or system preference.
// Writes are skipped when an override is active so the main site's theme
// state isn't clobbered by an iframe load.
function readUrlOverride(): StoredThemeState {
  if (typeof window === 'undefined') return {};
  try {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('theme');
    const p = q.get('template');
    return {
      theme: t === 'light' || t === 'dark' || t === 'system' ? t : undefined,
      template: p === 'hudson' || p === 'editorial' ? p : undefined,
    };
  } catch {
    return {};
  }
}

function hasUrlOverride(): boolean {
  const o = readUrlOverride();
  return Boolean(o.theme || o.template);
}

function readStoredThemeState(
  storageKey: string,
  defaultTheme: HudsonTheme,
  defaultTemplate: HudsonTemplate,
): StoredThemeState {
  if (typeof window === 'undefined') {
    return { theme: defaultTheme, template: defaultTemplate };
  }

  const override = readUrlOverride();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as StoredThemeState;
    return {
      theme: override.theme ?? parsed.theme ?? defaultTheme,
      template: override.template ?? parsed.template ?? defaultTemplate,
    };
  } catch {
    return {
      theme: override.theme ?? defaultTheme,
      template: override.template ?? defaultTemplate,
    };
  }
}

function resolveTheme(theme: HudsonTheme) {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }

  return theme;
}

function writeThemeAttributes(
  resolvedTheme: 'light' | 'dark',
  template: HudsonTemplate,
  rootElement?: HTMLElement | null,
) {
  const root = rootElement ?? document.documentElement;
  root.dataset.hudsonTheme = resolvedTheme;
  root.dataset.hudsonTemplate = template;
}

function writeStoredThemeState(storageKey: string, theme: HudsonTheme, template: HudsonTemplate) {
  // Skip persistence when a URL override is driving the theme — e.g. the
  // landing page's preview iframe loads /preview?theme=dark, and we don't
  // want that to clobber the visitor's real preference.
  if (hasUrlOverride()) return;
  try {
    const existing = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as unknown;
    const next = isPlainObject(existing)
      ? { ...existing, theme, template }
      : { theme, template };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage write failures in private mode or locked-down environments.
  }
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  defaultTemplate = DEFAULT_TEMPLATE,
  storageKey = DEFAULT_THEME_STORAGE_KEY,
  rootElement,
}: ThemeProviderProps) {
  const parentTheme = useContext(ThemeContext);

  const [theme, setThemeState] = useState<HudsonTheme>(() =>
    readStoredThemeState(storageKey, defaultTheme, defaultTemplate).theme ?? defaultTheme,
  );
  const [template, setTemplateState] = useState<HudsonTemplate>(() =>
    readStoredThemeState(storageKey, defaultTheme, defaultTemplate).template ?? defaultTemplate,
  );
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(theme));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (parentTheme) return;

    const state = readStoredThemeState(storageKey, defaultTheme, defaultTemplate);
    if (state.theme && state.theme !== theme) setThemeState(state.theme);
    if (state.template && state.template !== template) setTemplateState(state.template);
  }, [defaultTemplate, defaultTheme, parentTheme, storageKey, template, theme]);

  useEffect(() => {
    if (parentTheme) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateResolvedTheme = () => {
      setResolvedTheme(resolveTheme(theme));
    };

    updateResolvedTheme();
    media.addEventListener('change', updateResolvedTheme);
    return () => media.removeEventListener('change', updateResolvedTheme);
  }, [parentTheme, theme]);

  useEffect(() => {
    if (parentTheme) return;
    writeThemeAttributes(resolvedTheme, template, rootElement);
  }, [parentTheme, resolvedTheme, rootElement, template]);

  useEffect(() => {
    if (parentTheme) return;
    writeStoredThemeState(storageKey, theme, template);
  }, [parentTheme, storageKey, template, theme]);

  useEffect(() => {
    if (parentTheme) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const state = readStoredThemeState(storageKey, defaultTheme, defaultTemplate);
      setThemeState(state.theme ?? defaultTheme);
      setTemplateState(state.template ?? defaultTemplate);
    };

    const handleHudsonSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key !== storageKey) return;
      const state = readStoredThemeState(storageKey, defaultTheme, defaultTemplate);
      setThemeState(state.theme ?? defaultTheme);
      setTemplateState(state.template ?? defaultTemplate);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('hudson:saved', handleHudsonSaved);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('hudson:saved', handleHudsonSaved);
    };
  }, [defaultTemplate, defaultTheme, parentTheme, storageKey]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme: mounted ? resolvedTheme : undefined,
    template,
    setTheme: setThemeState,
    setTemplate: setTemplateState,
  }), [mounted, resolvedTheme, template, theme]);

  if (parentTheme) {
    return <>{children}</>;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}

export function useOptionalTheme() {
  return useContext(ThemeContext);
}
