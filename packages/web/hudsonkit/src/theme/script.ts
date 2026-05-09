export interface ThemeScriptOptions {
  storageKey?: string;
  defaultTheme?: 'light' | 'dark' | 'system';
  defaultTemplate?: string;
}

export const DEFAULT_THEME_STORAGE_KEY = 'hudson.theme';
export const DEFAULT_THEME = 'system';
export const DEFAULT_TEMPLATE = 'hudson';

const escapeValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export function getHudsonThemeScript({
  storageKey = DEFAULT_THEME_STORAGE_KEY,
  defaultTheme = DEFAULT_THEME,
  defaultTemplate = DEFAULT_TEMPLATE,
}: ThemeScriptOptions = {}) {
  const key = escapeValue(storageKey);
  const theme = escapeValue(defaultTheme);
  const template = escapeValue(defaultTemplate);

  // URL query params (?theme=dark&template=hudson) override localStorage.
  // Used by embedded iframes (e.g. the landing-page preview) that need a
  // predictable paint regardless of visitor preference. When the override
  // is present, ThemeProvider skips persisting state so the visitor's
  // real preference on the main site stays untouched.
  return `!function(k,t,p){try{var d=document.documentElement,q=new URLSearchParams(location.search),s=JSON.parse(localStorage.getItem(k)||'{}'),x=q.get('theme')||s.theme||t,y=q.get('template')||s.template||p,m='system'===x&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'system'===x?'light':x;d.dataset.hudsonTheme=m,d.dataset.hudsonTemplate=y}catch(e){var d=document.documentElement,m='system'===t&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'system'===t?'light':t;d.dataset.hudsonTheme=m,d.dataset.hudsonTemplate=p}}('${key}','${theme}','${template}');`;
}
