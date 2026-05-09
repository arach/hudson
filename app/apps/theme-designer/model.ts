export type ThemeMode = 'dark' | 'light';

export type TokenMap = Record<string, string>;

export interface ThemeTemplateRecord {
  id: string;
  base: TokenMap;
  themes: Record<ThemeMode, TokenMap>;
}

export interface ThemeDesignerSnapshot {
  templates: ThemeTemplateRecord[];
}

export interface OklchParts {
  l: number;
  c: number;
  h: number;
  alpha?: number;
  wrapper: boolean;
  alias?: string;
}

export const THEME_MODES: ThemeMode[] = ['dark', 'light'];
export const BUILT_IN_TEMPLATE_IDS = ['hudson', 'editorial', 'drafting'] as const;

export const SHADCN_TOKEN_ORDER = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--warning',
  '--success',
  '--info',
  '--border',
  '--input',
  '--ring',
  '--radius',
] as const;

export const HUD_TOKEN_ORDER = [
  '--hud-bg',
  '--hud-bg-2',
  '--hud-bg-3',
  '--hud-canvas-dot-minor',
  '--hud-canvas-dot-major',
  '--hud-surface',
  '--hud-border',
  '--hud-chrome-border',
  '--hud-shadow-soft',
  '--hud-shadow-panel',
  '--hud-shadow-bar',
  '--hud-shadow-nav',
  '--hud-shadow-minimap',
  '--hud-edge-fade-dark',
  '--hud-edge-fade-bottom',
  '--hud-ink',
  '--hud-ink-1',
  '--hud-ink-2',
  '--hud-ink-3',
  '--hud-muted',
  '--hud-dim',
  '--hud-line',
  '--hud-line-strong',
  '--hud-accent',
  '--hud-accent-soft',
  '--hud-accent-line',
  '--hud-status-ok',
  '--hud-status-warn',
  '--hud-status-error',
  '--hud-status-info',
  '--hud-radius',
  '--hud-font-sans',
  '--hud-font-mono',
  '--hud-font-serif',
] as const;

export const TOKEN_GROUPS = [
  {
    id: 'canvas',
    label: 'Canvas',
    tokens: ['--background', '--hud-bg', '--hud-bg-2', '--hud-bg-3', '--hud-canvas-dot-minor', '--hud-canvas-dot-major'],
  },
  {
    id: 'surface',
    label: 'Surface',
    tokens: [
      '--card',
      '--card-foreground',
      '--popover',
      '--popover-foreground',
      '--secondary',
      '--secondary-foreground',
      '--muted',
      '--border',
      '--input',
      '--hud-surface',
      '--hud-border',
      '--hud-chrome-border',
      '--hud-shadow-soft',
      '--hud-shadow-panel',
      '--hud-shadow-bar',
      '--hud-shadow-nav',
      '--hud-shadow-minimap',
      '--hud-edge-fade-dark',
      '--hud-edge-fade-bottom',
    ],
  },
  {
    id: 'ink',
    label: 'Ink',
    tokens: [
      '--foreground',
      '--muted-foreground',
      '--hud-ink',
      '--hud-ink-1',
      '--hud-ink-2',
      '--hud-ink-3',
      '--hud-muted',
      '--hud-dim',
      '--hud-line',
      '--hud-line-strong',
    ],
  },
  {
    id: 'accent',
    label: 'Accent',
    tokens: ['--primary', '--primary-foreground', '--accent', '--accent-foreground', '--ring', '--hud-accent', '--hud-accent-soft', '--hud-accent-line'],
  },
  {
    id: 'status',
    label: 'Status',
    tokens: ['--destructive', '--destructive-foreground', '--warning', '--success', '--info', '--hud-status-ok', '--hud-status-warn', '--hud-status-error', '--hud-status-info'],
  },
  {
    id: 'shape',
    label: 'Shape',
    tokens: ['--radius', '--hud-radius'],
  },
  {
    id: 'type',
    label: 'Type',
    tokens: ['--hud-font-sans', '--hud-font-mono', '--hud-font-serif'],
  },
] as const;

const ORDERED_TOKEN_KEYS = [
  'color-scheme',
  ...TOKEN_GROUPS.flatMap(group => group.tokens),
  ...SHADCN_TOKEN_ORDER,
  ...HUD_TOKEN_ORDER,
];

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function sanitizeTemplateId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

export function isValidTemplateId(value: string): boolean {
  return /^[a-z][a-z0-9-]{1,48}$/.test(value);
}

export function templateLabel(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function cloneTemplate(template: ThemeTemplateRecord): ThemeTemplateRecord {
  return {
    id: template.id,
    base: { ...template.base },
    themes: {
      dark: { ...template.themes.dark },
      light: { ...template.themes.light },
    },
  };
}

export function effectiveTokens(template: ThemeTemplateRecord, mode: ThemeMode): TokenMap {
  return {
    ...template.base,
    ...template.themes[mode],
  };
}

export function updateTemplateToken(
  template: ThemeTemplateRecord,
  mode: ThemeMode,
  key: string,
  value: string,
): ThemeTemplateRecord {
  const next = cloneTemplate(template);
  next.themes[mode] = {
    ...next.themes[mode],
    [key]: value,
  };
  if (key in next.base) {
    // Saved designer templates are emitted as per-theme blocks, so edits are
    // scoped to the active light/dark combo even when the source token came
    // from a shared base block in tokens.css.
    delete next.base[key];
  }
  return next;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseDeclarations(body: string): TokenMap {
  const declarations: TokenMap = {};
  const clean = stripComments(body);
  const re = /([\w-]+|--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(clean))) {
    declarations[match[1].trim()] = match[2].trim();
  }
  return declarations;
}

function ensureTemplate(map: Map<string, ThemeTemplateRecord>, id: string): ThemeTemplateRecord {
  const existing = map.get(id);
  if (existing) return existing;
  const next: ThemeTemplateRecord = { id, base: {}, themes: { dark: {}, light: {} } };
  map.set(id, next);
  return next;
}

export function parseThemeCss(css: string): ThemeDesignerSnapshot {
  const templates = new Map<string, ThemeTemplateRecord>();
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(css))) {
    const selector = match[1].trim();
    if (!selector.includes('data-hudson-template')) continue;
    const templateMatch = selector.match(/\[data-hudson-template=["']([^"']+)["']\]/);
    if (!templateMatch) continue;
    const id = templateMatch[1];
    const modeMatch = selector.match(/\[data-hudson-theme=["'](dark|light)["']\]/);
    const declarations = parseDeclarations(match[2]);
    const record = ensureTemplate(templates, id);

    if (modeMatch) {
      const mode = modeMatch[1] as ThemeMode;
      record.themes[mode] = { ...record.themes[mode], ...declarations };
    } else {
      record.base = { ...record.base, ...declarations };
    }
  }

  return {
    templates: [...templates.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function tokenGroupIndex(key: string): number {
  const idx = ORDERED_TOKEN_KEYS.indexOf(key as never);
  if (idx >= 0) return idx;
  if (key.startsWith('--hud-canvas')) return 10;
  if (key.startsWith('--hud-shadow') || key.includes('border')) return 60;
  if (key.startsWith('--hud-ink') || key.includes('foreground')) return 120;
  if (key.includes('accent') || key === '--ring' || key.includes('primary')) return 180;
  if (key.includes('warning') || key.includes('success') || key.includes('destructive') || key.includes('info') || key.includes('status')) return 240;
  if (key.includes('radius')) return 300;
  if (key.includes('font') || key.includes('text') || key.includes('leading') || key.includes('tracking') || key.includes('weight')) return 360;
  return 500;
}

export function sortTokenKeys(keys: string[]): string[] {
  return uniq(keys).sort((a, b) => {
    const ai = tokenGroupIndex(a);
    const bi = tokenGroupIndex(b);
    if (ai !== bi) return ai - bi;
    const ao = ORDERED_TOKEN_KEYS.indexOf(a as never);
    const bo = ORDERED_TOKEN_KEYS.indexOf(b as never);
    if (ao !== -1 && bo !== -1) return ao - bo;
    if (ao !== -1) return -1;
    if (bo !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function allTokenKeys(template: ThemeTemplateRecord): string[] {
  return sortTokenKeys([
    ...Object.keys(template.base),
    ...Object.keys(template.themes.dark),
    ...Object.keys(template.themes.light),
  ].filter(key => key === 'color-scheme' || key.startsWith('--')));
}

export function emitTemplateCss(template: ThemeTemplateRecord, id = template.id): string {
  const blocks = THEME_MODES.map(mode => {
    const tokens = effectiveTokens(template, mode);
    const keys = sortTokenKeys(Object.keys(tokens).filter(key => key === 'color-scheme' || key.startsWith('--')));
    const lines = keys.map(key => `  ${key}: ${tokens[key]};`);
    if (!tokens['color-scheme']) {
      lines.unshift(`  color-scheme: ${mode};`);
    }
    return `[data-hudson-template="${id}"][data-hudson-theme="${mode}"] {\n${lines.join('\n')}\n}`;
  });

  return blocks.join('\n\n');
}

export function diffTemplateTokens(template: ThemeTemplateRecord, saved: ThemeTemplateRecord | undefined, mode: ThemeMode): string[] {
  if (!saved) return allTokenKeys(template);
  const currentTokens = effectiveTokens(template, mode);
  const savedTokens = effectiveTokens(saved, mode);
  return sortTokenKeys([
    ...Object.keys(currentTokens),
    ...Object.keys(savedTokens),
  ].filter(key => currentTokens[key] !== savedTokens[key]));
}

export function formatOklch({ l, c, h, alpha, wrapper }: OklchParts): string {
  const body = `${round(l, 3)} ${round(c, 3)} ${round(h, 1)}`;
  const withAlpha = alpha === undefined ? body : `${body} / ${round(alpha, 3)}`;
  return wrapper ? `oklch(${withAlpha})` : withAlpha;
}

export function round(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

export function parseOklchValue(value: string, resolver?: (name: string) => string | undefined): OklchParts | null {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^oklch\((.*)\)$/i);
  const inner = wrapped ? wrapped[1].trim() : trimmed;
  const parts = inner.split('/').map(part => part.trim());
  const colorPart = parts[0];
  const alpha = parseNumber(parts[1]);

  const aliasMatch = colorPart.match(/^var\((--[\w-]+)\)$/);
  if (aliasMatch) {
    const resolved = resolver?.(aliasMatch[1]);
    if (!resolved) return null;
    const parsed = parseOklchValue(resolved, resolver);
    if (!parsed) return null;
    return {
      ...parsed,
      alpha: alpha ?? parsed.alpha,
      wrapper: true,
      alias: aliasMatch[1],
    };
  }

  const nums = colorPart.split(/\s+/).filter(Boolean);
  if (nums.length < 3) return null;
  const l = parseNumber(nums[0]);
  const c = parseNumber(nums[1]);
  const h = parseNumber(nums[2]);
  if (l === null || c === null || h === null) return null;

  return {
    l,
    c,
    h,
    alpha: alpha ?? undefined,
    wrapper: Boolean(wrapped),
  };
}

export function tokenSwatchValue(value: string, resolver?: (name: string) => string | undefined): string | null {
  const parsed = parseOklchValue(value, resolver);
  if (parsed) return formatOklch({ ...parsed, wrapper: true });
  if (/^(#[0-9a-f]{3,8}|rgb|hsl|oklab|color\()/i.test(value.trim())) return value.trim();
  return null;
}

export function setOklchPart(
  rawValue: string,
  next: Partial<Pick<OklchParts, 'l' | 'c' | 'h' | 'alpha'>>,
  resolver?: (name: string) => string | undefined,
): string {
  const parsed = parseOklchValue(rawValue, resolver) ?? { l: 0.5, c: 0.1, h: 180, wrapper: rawValue.trim().startsWith('oklch(') };
  return formatOklch({
    ...parsed,
    ...next,
    wrapper: parsed.wrapper || rawValue.trim().startsWith('oklch('),
    alias: undefined,
  });
}
