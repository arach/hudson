import type { IntentCategory } from '@hudson/sdk';

// ---------------------------------------------------------------------------
// Category badge colors (shared across components)
// ---------------------------------------------------------------------------
export const CATEGORY_COLORS: Record<IntentCategory, string> = {
  tool: 'text-cyan-400 bg-cyan-400/10',
  edit: 'text-amber-400 bg-amber-400/10',
  file: 'text-emerald-400 bg-emerald-400/10',
  view: 'text-sky-400 bg-sky-400/10',
  navigation: 'text-teal-400 bg-teal-400/10',
  toggle: 'text-neutral-400 bg-neutral-400/10',
  workspace: 'text-blue-400 bg-blue-400/10',
  settings: 'text-neutral-400 bg-neutral-400/10',
};

// ---------------------------------------------------------------------------
// Floating card
// ---------------------------------------------------------------------------
export interface FloatingCard {
  id: string;        // unique card instance id
  intentId: string;  // commandId of the pinned intent
  zIndex: number;
}
