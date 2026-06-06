// ─────────────────────────────────────────────────────────────────────────────
// Workspace decoration types
// ─────────────────────────────────────────────────────────────────────────────
// Decorations are read-only, app-like placards that live on the workspace
// canvas underneath app windows. The `stage-design` app is the management
// surface; the WorkspaceShell renders the items in world space.
// ─────────────────────────────────────────────────────────────────────────────

export type DecorSizing = 'small' | 'medium' | 'large' | 'full';

export interface DecorBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sizing?: DecorSizing;
}

/** Typographic text decoration. The `subtype` selects the treatment. */
export interface TextDecor extends DecorBase {
  type: 'text';
  subtype: 'eyebrow' | 'display-title' | 'body' | 'divider';
  /** Plain text (or `null` for divider). */
  text: string;
  /** Optional accent word — italicized + accent-colored when present.
   *  Only used by `display-title`. The first occurrence in `text` is replaced. */
  accent?: string;
}

/** Image decoration. */
export interface ImageDecor extends DecorBase {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
}

/** External website embed. Rendered as an iframe; falls back to a link card
 *  if the iframe fails to load (e.g. X-Frame-Options blocks it). */
export interface WebDecor extends DecorBase {
  type: 'web';
  url: string;
  title?: string;
}

/** A "step card" — eyebrow + numbered verb + body + optional code block.
 *  The build-sequence layout uses these. */
export interface StepCardDecor extends DecorBase {
  type: 'step-card';
  step: string;
  verb: string;
  body: string;
  code?: string;
}

export type DecorationItem = TextDecor | ImageDecor | WebDecor | StepCardDecor;

export type DecorationType = DecorationItem['type'];

export interface DecorState {
  items: DecorationItem[];
  visible: boolean;
  updatedAt?: number;
}

export const EMPTY_DECOR_STATE: DecorState = { items: [], visible: true };

/** Default item dimensions per sizing preset (in world pixels at 1× scale). */
export const SIZING_PRESETS: Record<DecorSizing, { w: number; h: number }> = {
  small: { w: 240, h: 140 },
  medium: { w: 420, h: 240 },
  large: { w: 640, h: 380 },
  full: { w: 960, h: 540 },
};
