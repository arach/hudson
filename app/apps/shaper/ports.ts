import { useCallback } from 'react';
import { useShaper } from './ShaperProvider';

/**
 * Port output hook for Shaper.
 * Returns an SVG string of the current canvas when the 'svg' port is read.
 */
export function useShaperPortOutput() {
  const { strokesPath, pathColor, fillEnabled, fillPattern } = useShaper();

  return useCallback((portId: string): unknown | null => {
    if (portId !== 'svg') return null;
    if (!strokesPath) return null;

    const fill = fillEnabled ? pathColor : 'none';
    const stroke = fillEnabled && fillPattern === 'solid' ? 'none' : pathColor;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="${strokesPath}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
</svg>`;
  }, [strokesPath, pathColor, fillEnabled, fillPattern]);
}
