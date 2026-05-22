'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AI_MODEL_OPTIONS,
  mergeCopilotModelOptions,
  type AISelectOption,
} from './ai-models';

interface AIModelsRouteResponse {
  source?: string;
  options?: AISelectOption[];
}

export function useAIModelOptions() {
  const [liveOptions, setLiveOptions] = useState<AISelectOption[] | null>(null);
  const [source, setSource] = useState<'static' | 'live'>('static');

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/ai/models?provider=copilot', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AIModelsRouteResponse>;
      })
      .then(data => {
        if (Array.isArray(data.options) && data.options.length > 0) {
          setLiveOptions(data.options.filter(option => option.provider === 'copilot'));
          setSource(data.source === 'live' ? 'live' : 'static');
        }
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLiveOptions(null);
        setSource('static');
      });

    return () => controller.abort();
  }, []);

  const modelOptions = useMemo(
    () => liveOptions ? mergeCopilotModelOptions(liveOptions) : AI_MODEL_OPTIONS,
    [liveOptions],
  );

  return { modelOptions, source };
}
