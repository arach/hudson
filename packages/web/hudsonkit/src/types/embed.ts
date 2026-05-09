// ---------------------------------------------------------------------------
// EmbedSurface — declares an embeddable view surface for an app.
// See docs/embed-primitive.md (RFC v0.3 §1) for the full spec.
// ---------------------------------------------------------------------------

export type EmbedSizing =
  | { mode: 'fixed'; width: number; height: number }
  | { mode: 'responsive'; aspectRatio?: string; minHeight?: number }
  | { mode: 'fill' };

export interface EmbedSurface {
  /** Unique surface id within the app (used in /embed/[appId]/[surface] route) */
  id: string;
  /** Human-readable name shown in share sheet and palette */
  name: string;
  /** Slot key or standalone component to render in the embed frame */
  slot: string | React.FC;
  /** How the embed sizes itself within the host container */
  sizing: EmbedSizing;
  /** Whether the embed accepts user interaction (default true) */
  interactive?: boolean;
  /** Whether shell chrome is hidden in the embed frame (default true) */
  chromeless?: boolean;
  /** Theme inheritance: 'inherit' applies host tokens, 'fixed' ignores them (default 'inherit') */
  themeMode?: 'inherit' | 'fixed';
}

export interface AppExports {
  embeds?: EmbedSurface[];
}
