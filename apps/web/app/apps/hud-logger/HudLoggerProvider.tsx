'use client';

import { useEffect, type ReactNode } from 'react';
import { HObservabilityDefault } from 'hudsonkit/observability';

export function HudLoggerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    HObservabilityDefault.setEnabled(true);
    HObservabilityDefault.logger.info('hudson.logger.ready', {
      category: 'observability',
      data: { surface: 'hudson-app' },
    });
  }, []);

  return children;
}
