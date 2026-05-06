'use client';

import { useCallback } from 'react';
import { useImageProcess } from './ImageProcessProvider';

export function useImageProcessPortOutput() {
  const { processedDataUrl, manifest, params, animation, programId } = useImageProcess();

  return useCallback((portId: string): unknown | null => {
    if (portId === 'image') return processedDataUrl;
    if (portId === 'manifest') return manifest;
    if (portId === 'recipe') {
      return {
        program: manifest?.program ?? programId,
        params,
        animation,
      };
    }
    return null;
  }, [animation, manifest, params, processedDataUrl, programId]);
}

export function useImageProcessPortInput() {
  const { loadDataUrl } = useImageProcess();

  return useCallback((portId: string, data: unknown) => {
    if (portId !== 'image' || typeof data !== 'string') return;
    void loadDataUrl(data, 'piped-image');
  }, [loadDataUrl]);
}
