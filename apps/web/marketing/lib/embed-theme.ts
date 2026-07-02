import {
  ACCENTS,
  BODY_FONTS,
  DEFAULTS,
  DISPLAY_FONTS,
  MONO_FONTS,
  PAPERS,
  type StudioState,
} from '@/marketing/theme/defaults';

/**
 * Wire format the embed URL passes to the donor. Donor SSRs from this.
 * Keep keys in `--hud-*` namespace so donor's CSS resolves them directly.
 */
export interface EmbedThemePayload {
  palette: Record<string, string>;
  fonts: Record<string, string>;
}

const PARENT_TO_HUD_PALETTE: Record<string, string> = {
  '--paper': '--hud-bg',
  '--paper-2': '--hud-bg-2',
  '--paper-3': '--hud-bg-3',
  '--ink': '--hud-ink',
  '--ink-1': '--hud-ink-1',
  '--ink-2': '--hud-ink-2',
  '--ink-3': '--hud-ink-3',
  '--line': '--hud-line',
  '--line-strong': '--hud-line-strong',
  '--accent': '--hud-accent',
  '--accent-soft': '--hud-accent-soft',
  '--accent-line': '--hud-accent-line',
};

const PARENT_TO_HUD_FONTS: Record<string, string> = {
  '--font-display': '--hud-font-display',
  '--font-body': '--hud-font-body',
  '--font-mono': '--hud-font-mono',
};

export function resolveEmbedTheme(state: StudioState): EmbedThemePayload {
  const accent = ACCENTS.find((a) => a.id === state.accent) ?? ACCENTS[0];
  const paper = PAPERS.find((p) => p.id === state.paper) ?? PAPERS[0];
  const display = DISPLAY_FONTS.find((f) => f.id === state.display) ?? DISPLAY_FONTS[0];
  const body = BODY_FONTS.find((f) => f.id === state.body) ?? BODY_FONTS[0];
  const mono = MONO_FONTS.find((f) => f.id === state.mono) ?? MONO_FONTS[0];

  const parentVars: Record<string, string> = {
    ...paper.vars,
    ...accent.vars,
  };

  const palette: Record<string, string> = {};
  for (const [parentKey, hudKey] of Object.entries(PARENT_TO_HUD_PALETTE)) {
    const v = parentVars[parentKey];
    if (v) palette[hudKey] = v;
  }
  palette['--hud-border-width'] = `${state.strokeW ?? DEFAULTS.strokeW}px`;

  const fontResolved: Record<string, string> = {
    '--font-display': display.cssValue,
    '--font-body': body.cssValue,
    '--font-mono': mono.cssValue,
  };
  const fonts: Record<string, string> = {};
  for (const [parentKey, hudKey] of Object.entries(PARENT_TO_HUD_FONTS)) {
    const v = fontResolved[parentKey];
    if (v) fonts[hudKey] = v;
  }

  return { palette, fonts };
}

function toBase64Url(input: string): string {
  if (typeof btoa === 'function') {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  if (typeof atob === 'function') return atob(padded + pad);
  return Buffer.from(padded + pad, 'base64').toString('utf-8');
}

export function encodeThemeForEmbed(state: StudioState): string {
  return toBase64Url(JSON.stringify(resolveEmbedTheme(state)));
}

export function decodeThemeForEmbed(encoded: string): EmbedThemePayload | undefined {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<EmbedThemePayload>;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return {
      palette: { ...(parsed.palette ?? {}) },
      fonts: { ...(parsed.fonts ?? {}) },
    };
  } catch {
    return undefined;
  }
}

export function inlineThemeStyle(payload: EmbedThemePayload): Record<string, string> {
  return { ...payload.palette, ...payload.fonts };
}
