'use client';

import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * ## Roving-focus evaluation (Base UI composite vs container hook)
 *
 * Base UI ships internal composite primitives (`CompositeRoot` / `CompositeItem`)
 * used by Menu, Select, Tabs, etc. They are `@internal`, require per-item
 * registration, and are not a public “drop a key handler on a container of
 * buttons” API.
 *
 * This hook attaches one `onKeyDown` to a container and moves focus among
 * **visible, non-disabled `button`s** with ArrowUp/Down/Home/End — skipping
 * inputs/textareas/selects/contenteditable. Kit MenuButton rows and hand-
 * composed rail buttons join without per-row wiring.
 *
 * **Decision: keep useRovingNav. Do not wrap Base UI composite.**
 * Base UI owns roving inside HudMenu / HudSelectBase / ContextMenu popups.
 *
 * Opt-in on HudSideNav via `rovingFocus` (default off).
 * Donor: Iris `web/src/behaviors/roving.ts` (package 02).
 */

/**
 * Arrow/Home/End roving focus across visible buttons under the event target.
 * Text fields keep native caret keys. Attach on the list container:
 *
 *   <nav onKeyDown={useRovingNav()}>…</nav>
 */
export function useRovingNav() {
  return useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable=true]')) return;
    const rows = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ].filter((row) => {
      // offsetParent is null for display:none (and often in jsdom). Prefer a
      // layout check that still works under test and collapses hidden rails.
      if (row.hidden || row.getAttribute('aria-hidden') === 'true') return false;
      const style = typeof getComputedStyle === 'function' ? getComputedStyle(row) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      if (row.offsetParent === null) {
        // jsdom: treat in-document buttons as visible when no layout engine.
        return row.isConnected;
      }
      return true;
    });
    if (!rows.length) return;
    event.preventDefault();
    // Prefer the focused control when the event was dispatched on the container
    // (synthetic tests / some host environments).
    const active =
      document.activeElement instanceof HTMLElement &&
      event.currentTarget.contains(document.activeElement)
        ? document.activeElement
        : target;
    const currentBtn = active.closest('button') as HTMLButtonElement | null;
    const current = currentBtn ? rows.indexOf(currentBtn) : -1;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(rows.length - 1, current + 1)
            : Math.max(0, (current < 0 ? rows.length : current) - 1);
    rows[next]?.focus();
  }, []);
}

/** Documented evaluation result for consumers and the upstream map. */
export const ROVING_FOCUS_EVAL = {
  baseUiComposite: 'internal-only; not a public container API',
  decision: 'keep-useRovingNav' as const,
  reason:
    'Needs container-level Arrow/Home/End over mixed kit + hand-composed buttons without per-item CompositeItem registration.',
} as const;
