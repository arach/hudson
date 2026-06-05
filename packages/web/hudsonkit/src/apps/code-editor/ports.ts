'use client';

import { useCallback } from 'react';
import { useCodeEditor } from './CodeEditorProvider';

export function useCodeEditorPortOutput() {
  const { getOutput } = useCodeEditor();

  return useCallback((portId: string): unknown | null => getOutput(portId), [getOutput]);
}

export function useCodeEditorPortInput() {
  const { openFromInput } = useCodeEditor();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'document' || portId === 'json' || portId === 'text') {
      openFromInput(portId, data);
    }
  }, [openFromInput]);
}
