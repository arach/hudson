/** Shared types for HudsonKit primitives. */

export type HudDensity = 'compact' | 'default';

export type HudTone = 'neutral' | 'accent' | 'success' | 'warning' | 'destructive';

/** Tone → Tailwind class mappings (border, bg, text). */
export const toneClasses: Record<HudTone, { border: string; bg: string; text: string }> = {
  neutral:     { border: 'border-border',           bg: 'bg-muted/40',          text: 'text-foreground' },
  accent:      { border: 'border-accent/30',        bg: 'bg-accent/10',         text: 'text-accent-foreground' },
  success:     { border: 'border-success/30',       bg: 'bg-success/10',        text: 'text-success' },
  warning:     { border: 'border-warning/30',       bg: 'bg-warning/10',        text: 'text-warning' },
  destructive: { border: 'border-destructive/30',   bg: 'bg-destructive/10',    text: 'text-destructive' },
};
