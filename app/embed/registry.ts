// ─────────────────────────────────────────────────────────────────────────────
// Embed Consumer Registry — RFC v0.3 §12, refined per v0.4 (URL-params-first)
// ─────────────────────────────────────────────────────────────────────────────
// When an embed URL carries `?ref=<consumerId>`, the server-side render looks
// the consumer up here and applies its palette / fonts / template / default
// workspace before first paint. This avoids a postMessage round-trip and the
// flash of unstyled embed that would come with it.
//
// postMessage `hudson:embed-context` and `hudson:theme-sync` are *live updates
// only* — they don't drive first paint.
//
// Today this lives on the consumer side (our marketing repo) for symmetry with
// Hudson's own registry. Hudson maintains an identical-shape `consumers` map
// at `app/embed/registry.ts` in their repo; we duplicate so each side can
// render its own embed surfaces without a network hop to the other.
// ─────────────────────────────────────────────────────────────────────────────

export type EmbedTheme = 'dark' | 'light';

export interface ConsumerConfig {
  ref: string;
  theme: EmbedTheme;
  template: string;
  defaultWorkspace: string;
  /** App to focus when this consumer opens a workspace embed. */
  defaultFocus?: string;
  /** Optional subset/order of apps to show by default in workspace embeds. */
  defaultApps?: string[];
  /** `--hud-*` semantic tokens for components that opt into hudsonkit tokens. */
  palette: Record<string, string>;
  /** `--hud-font-*` family tokens. */
  fonts: Record<string, string>;
  /** Shadcn-style `--background`, `--accent`, etc. (LCH triplets, no `oklch()` wrapper).
   *  Drives Tailwind utilities like `bg-background`, `bg-accent` that the
   *  WorkspaceShell renders. Without these set, shell components fall back to
   *  hudson's global dark+emerald palette. */
  shadcn?: Record<string, string>;
}

export const consumers: Record<string, ConsumerConfig> = {
  // Drafting marketing preset for the HudsonKit site.
  // Theming is driven by the `drafting` template (slate paper + amber accent),
  // applied via [data-hudson-template="drafting"] on <html>. The palette/fonts
  // below remain as `--hud-*` semantic-token complements; shadcn vars come
  // from tokens.css.
  hudsonos: {
    ref: 'hudsonos',
    theme: 'dark',
    template: 'drafting',
    defaultWorkspace: 'hudson-os',
    defaultFocus: 'hudson-docs',
    defaultApps: ['stage-design', 'theme-designer', 'hudson-docs'],
    palette: {
      '--hud-bg':           'oklch(0.20 0.02 240)',
      '--hud-bg-2':         'oklch(0.24 0.02 240)',
      '--hud-bg-3':         'oklch(0.28 0.02 240)',
      '--hud-ink':          'oklch(0.94 0.005 240)',
      '--hud-ink-1':        'oklch(0.85 0.005 240)',
      '--hud-ink-2':        'oklch(0.70 0.008 240)',
      '--hud-ink-3':        'oklch(0.55 0.01 240)',
      '--hud-line':         'oklch(0.40 0.012 240)',
      '--hud-line-strong':  'oklch(0.62 0.012 240)',
      '--hud-accent':       'oklch(0.72 0.18 60)',
      '--hud-accent-soft':  'oklch(0.72 0.18 60 / 0.12)',
      '--hud-accent-line':  'oklch(0.72 0.18 60 / 0.45)',
      '--hud-border-width': '1.5px',
    },
    fonts: {
      '--hud-font-display': 'var(--font-newsreader), "Times New Roman", serif',
      '--hud-font-body':    'var(--font-space-grotesk), system-ui, sans-serif',
      '--hud-font-mono':    'var(--font-jetbrains-mono), ui-monospace, monospace',
    },
  },

  // hudson-linen — cream-paper light showcase.
  // Proves Hudson can shed the default emerald-on-black skin: warm linen
  // canvas, brown ink, amber accent. Uses the `drafting` template so chrome
  // styles cascade from [data-hudson-template="drafting"][data-hudson-theme="light"]
  // in tokens.css; the registry palette below overrides those tokens with the
  // linen-specific values for this consumer.
  'hudson-linen': {
    ref: 'hudson-linen',
    theme: 'light',
    template: 'drafting',
    defaultWorkspace: 'hudson-os',
    defaultFocus: 'hudson-docs',
    defaultApps: ['stage-design', 'theme-designer', 'hudson-docs'],
    palette: {
      '--hud-bg':           'oklch(0.95 0.012 70)',
      '--hud-bg-2':         'oklch(0.97 0.010 70)',
      '--hud-bg-3':         'oklch(0.93 0.014 70)',
      '--hud-ink':          'oklch(0.22 0.014 60)',
      '--hud-ink-1':        'oklch(0.32 0.014 60)',
      '--hud-ink-2':        'oklch(0.52 0.010 60)',
      '--hud-ink-3':        'oklch(0.70 0.010 60)',
      '--hud-line':         'oklch(0.88 0.010 70)',
      '--hud-line-strong':  'oklch(0.75 0.012 70)',
      '--hud-accent':       'oklch(0.62 0.18 50)',
      '--hud-accent-soft':  'oklch(0.62 0.18 50 / 0.08)',
      '--hud-accent-line':  'oklch(0.62 0.18 50 / 0.40)',
      '--hud-border-width': '1.5px',
    },
    fonts: {
      '--hud-font-display': 'var(--font-newsreader), "Times New Roman", serif',
      '--hud-font-body':    'var(--font-space-grotesk), system-ui, sans-serif',
      '--hud-font-mono':    'var(--font-jetbrains-mono), ui-monospace, monospace',
    },
  },

  // Reference / unstyled embed — accessor for the embed's "native" defaults
  // (dark + emerald). Useful when an iframe is hosted standalone and wants to
  // display Hudson's own brand palette rather than a consumer's.
  hudson: {
    ref: 'hudson',
    theme: 'dark',
    template: 'hudson',
    defaultWorkspace: 'hudson-os',
    defaultFocus: 'hudson-docs',
    defaultApps: ['stage-design', 'theme-designer', 'hudson-docs'],
    palette: {
      '--hud-bg':           'oklch(0.16 0.005 240)',
      '--hud-bg-2':         'oklch(0.20 0.005 240)',
      '--hud-bg-3':         'oklch(0.24 0.005 240)',
      '--hud-ink':          'oklch(0.96 0.005 240)',
      '--hud-ink-1':        'oklch(0.86 0.005 240)',
      '--hud-ink-2':        'oklch(0.66 0.008 240)',
      '--hud-ink-3':        'oklch(0.50 0.01 240)',
      '--hud-line':         'oklch(0.32 0.012 240)',
      '--hud-line-strong':  'oklch(0.48 0.012 240)',
      '--hud-accent':       'oklch(0.68 0.16 50)',
      '--hud-accent-soft':  'oklch(0.68 0.16 50 / 0.10)',
      '--hud-accent-line':  'oklch(0.68 0.16 50 / 0.45)',
      '--hud-border-width': '1px',
    },
    fonts: {
      '--hud-font-display': 'var(--font-newsreader), "Times New Roman", serif',
      '--hud-font-body':    'var(--font-space-grotesk), system-ui, sans-serif',
      '--hud-font-mono':    'var(--font-jetbrains-mono), ui-monospace, monospace',
    },
  },
};

/** Look up a consumer by `?ref=` value. Returns undefined if not registered. */
export function resolveConsumer(ref: string | null | undefined): ConsumerConfig | undefined {
  if (!ref) return undefined;
  return consumers[ref];
}

/** Compose a style object for the resolved consumer (palette + fonts + shadcn vars).
 *  Suitable as inline `style` on an embed-root element, cascading to all
 *  descendants that use `var(--hud-*)` or shadcn `var(--background)` etc. */
export function consumerThemeStyle(ref: string | null | undefined): React.CSSProperties | undefined {
  const consumer = resolveConsumer(ref);
  if (!consumer) return undefined;
  return {
    ...consumer.palette,
    ...consumer.fonts,
    ...(consumer.shadcn ?? {}),
  } as React.CSSProperties;
}
