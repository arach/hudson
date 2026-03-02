import { useMemo } from 'react';
import { usePlatform } from './PlatformContext';
import { SHELL_THEME } from '../lib/theme';

export interface PlatformLayout {
  /** Total nav bar height including native title bar inset. */
  navTotalHeight: number;
  /** Top offset for side panels (same as navTotalHeight). */
  panelTopOffset: number;
}

/**
 * Derives layout measurements from the base shell theme + active platform adapter.
 * Use this instead of hardcoded 48px values in chrome components.
 */
export function usePlatformLayout(): PlatformLayout {
  const { titleBarInset } = usePlatform();

  return useMemo(() => {
    const navTotalHeight = SHELL_THEME.layout.navHeight + titleBarInset;
    return {
      navTotalHeight,
      panelTopOffset: navTotalHeight,
    };
  }, [titleBarInset]);
}
