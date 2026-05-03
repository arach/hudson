import type { TemplateVars } from './utils';

// ---------------------------------------------------------------------------
// String replacement engine
// ---------------------------------------------------------------------------

/** Replace all template variables in file content */
export function transform(content: string, vars: TemplateVars): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

/** Replace template variables in a filename (e.g. __APP_NAME__Content.tsx.tmpl → MyBrowserContent.tsx) */
export function transformFilename(name: string, vars: TemplateVars): string {
  let result = name;
  // Strip .tmpl extension
  if (result.endsWith('.tmpl')) {
    result = result.slice(0, -5);
  }
  // Replace placeholders in filename
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}
