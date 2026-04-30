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
 *
 * Also accepts SVG data URLs (e.g. `data:image/svg+xml;base64,...` or
 * `data:image/svg+xml;utf8,...`) emitted by apps like Assets — these are
 * decoded to raw SVG so the rasterizer can parse them.
 */
export function useLogoPortInput() {
  const { setBackgroundSvg } = useLogo();

  return useCallback((portId: string, data: unknown) => {
    if (portId !== 'background-svg' || typeof data !== 'string') return;

    // If the incoming string is an SVG data URL, decode it to raw SVG.
    const dataUrlMatch = data.match(/^data:image\/svg\+xml(?:;[^,]*)?,(.*)$/);
    if (dataUrlMatch) {
      const isBase64 = /;base64/i.test(data.slice(0, data.indexOf(',')));
      const payload = dataUrlMatch[1];
      try {
        const decoded = isBase64
          ? (typeof atob === 'function' ? atob(payload) : Buffer.from(payload, 'base64').toString('utf-8'))
          : decodeURIComponent(payload);
        setBackgroundSvg(decoded);
        return;
      } catch {
        // fall through to raw
      }
    }

    setBackgroundSvg(data);
  }, [setBackgroundSvg]);
}
