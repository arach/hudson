'use client';

import { useEffect, useState } from 'react';
import { AI_MODELS_PATH, type AISelectOption } from './ai-models';

export function useAIModelOptions() {
  const [modelOptions, setModelOptions] = useState<AISelectOption[]>([]);
  const [source, setSource] = useState<'registry' | 'live'>('registry');

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(AI_MODELS_PATH, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && Array.isArray(data.options)) {
          setModelOptions(data.options);
          setSource(data.source === 'live' ? 'live' : 'registry');
        }
      } catch { /* Retain the last successful catalog until the next refresh. */ }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, []);

  return { modelOptions, source };
}
