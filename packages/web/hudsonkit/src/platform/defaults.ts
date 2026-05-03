import type { PlatformAdapter } from './types';

/** Zero-config web defaults — used when no PlatformProvider is present. */
export const WEB_ADAPTER: PlatformAdapter = {
  titleBarInset: 0,
  dragRegionProps: {},
  onInteractiveMouseDown: undefined,
  isSSR: true,
  apiBaseUrl: '',
  serviceApiUrl: '',
};
