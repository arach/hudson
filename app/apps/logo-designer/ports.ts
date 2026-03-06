import { useCallback } from 'react';
import { useLogo } from './LogoProvider';

/**
 * Port output hook for Logo.
 * Returns the current logo SVG params as a serialized description.
 */
export function useLogoPortOutput() {
  const { params } = useLogo();

  return useCallback((portId: string): unknown | null => {
    if (portId !== 'params') return null;
    return JSON.stringify(params);
  }, [params]);
}

/**
 * Port input hook for Logo.
 * Accepts an SVG string on the 'background-svg' port.
 */
export function useLogoPortInput() {
  const { setBackgroundSvg } = useLogo();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'background-svg' && typeof data === 'string') {
      setBackgroundSvg(data);
    }
  }, [setBackgroundSvg]);
}
