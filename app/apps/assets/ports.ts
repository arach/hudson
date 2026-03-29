'use client';

import { useCallback } from 'react';
import { useAssets } from './AssetsProvider';

/**
 * Output port: provides the selected asset's dataUrl.
 * Returns the cached dataUrl if available, or the displayUrl as fallback.
 */
export function useAssetsPortOutput() {
  const { selectedAsset } = useAssets();
  return useCallback((portId: string): unknown | null => {
    if (portId === 'image' && selectedAsset) {
      return selectedAsset.dataUrl ?? selectedAsset.displayUrl;
    }
    return null;
  }, [selectedAsset]);
}
