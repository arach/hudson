// ---------------------------------------------------------------------------
// Name casing utilities
// ---------------------------------------------------------------------------

/** "my-browser" → "MyBrowser" */
export function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** "my-browser" → "myBrowser" */
export function toCamelCase(kebab: string): string {
  const pascal = toPascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** "my-browser" → "My Browser" */
export function toDisplayName(kebab: string): string {
  return kebab
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** "MyBrowser" → "my-browser" (for safety — input should already be kebab) */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ID = /^[a-z][a-z0-9-]*$/;

export function validateAppName(id: string): string | null {
  if (!id) return 'App name is required';
  if (!VALID_ID.test(id)) return 'App name must be lowercase, start with a letter, and use hyphens (e.g. my-app)';
  if (id.length < 2) return 'App name must be at least 2 characters';
  if (id.length > 40) return 'App name must be at most 40 characters';
  return null;
}

// ---------------------------------------------------------------------------
// Icon suggestion — maps common keywords to Lucide icon names
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, string> = {
  browser: 'Globe',
  web: 'Globe',
  mail: 'Mail',
  email: 'Mail',
  chat: 'MessageCircle',
  message: 'MessageCircle',
  note: 'StickyNote',
  notes: 'StickyNote',
  editor: 'FileEdit',
  code: 'Code',
  terminal: 'Terminal',
  file: 'FileText',
  files: 'FolderOpen',
  folder: 'FolderOpen',
  image: 'Image',
  photo: 'Camera',
  music: 'Music',
  audio: 'Headphones',
  video: 'Video',
  player: 'Play',
  calendar: 'Calendar',
  todo: 'CheckSquare',
  task: 'CheckSquare',
  settings: 'Settings',
  config: 'Sliders',
  search: 'Search',
  map: 'Map',
  chart: 'BarChart3',
  graph: 'LineChart',
  dashboard: 'LayoutDashboard',
  monitor: 'Monitor',
  data: 'Database',
  api: 'Plug',
  paint: 'Paintbrush',
  draw: 'PenTool',
  design: 'Palette',
  book: 'BookOpen',
  docs: 'FileText',
  log: 'ScrollText',
  list: 'List',
  table: 'Table',
  grid: 'Grid3x3',
  tree: 'GitBranch',
  network: 'Network',
  cloud: 'Cloud',
  download: 'Download',
  upload: 'Upload',
  share: 'Share2',
  user: 'User',
  profile: 'UserCircle',
  clock: 'Clock',
  timer: 'Timer',
  calculator: 'Calculator',
};

export function suggestIcon(appId: string): string {
  const words = appId.split('-');
  for (const word of words) {
    if (ICON_MAP[word]) return ICON_MAP[word];
  }
  return 'Box';
}

// ---------------------------------------------------------------------------
// Template variable map
// ---------------------------------------------------------------------------

export interface TemplateVars {
  __APP_NAME__: string;
  __APP_ID__: string;
  __APP_VAR__: string;
  __APP_DISPLAY_NAME__: string;
  __APP_DESCRIPTION__: string;
  __APP_MODE__: string;
  __APP_ICON__: string;
}

export function buildVars(
  appId: string,
  description: string,
  mode: 'panel' | 'canvas',
  icon?: string,
): TemplateVars {
  return {
    __APP_NAME__: toPascalCase(appId),
    __APP_ID__: appId,
    __APP_VAR__: toCamelCase(appId),
    __APP_DISPLAY_NAME__: toDisplayName(appId),
    __APP_DESCRIPTION__: description,
    __APP_MODE__: mode,
    __APP_ICON__: icon ?? suggestIcon(appId),
  };
}

/** App tiers scaffold monorepo `app/apps/*`. `standalone` is a private
 *  Vite + TanStack consumer-client project (HUD-014) — not for in-repo apps. */
export type Tier = 'minimal' | 'standard' | 'full' | 'standalone';
