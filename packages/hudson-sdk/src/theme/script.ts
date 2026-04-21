export interface ThemeScriptOptions {
  storageKey?: string;
  defaultTheme?: 'light' | 'dark' | 'system';
  defaultTemplate?: 'hudson' | 'editorial';
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

  return `!function(k,t,p){try{var d=document.documentElement,s=JSON.parse(localStorage.getItem(k)||'{}'),x=s.theme||t,y=s.template||p,m='system'===x&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'system'===x?'light':x;d.dataset.hudsonTheme=m,d.dataset.hudsonTemplate=y}catch(e){var d=document.documentElement,m='system'===t&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'system'===t?'light':t;d.dataset.hudsonTheme=m,d.dataset.hudsonTemplate=p}}('${key}','${theme}','${template}');`;
}
