'use client';

import { useMemo } from 'react';
import {
  HObservabilityDefault,
  useHudLoggerSummary,
} from 'hudsonkit/observability';
import type { CommandOption, StatusColor } from 'hudsonkit';

const MAX_EVENTS = 240;

export function useHudLoggerCommands(): CommandOption[] {
  return useMemo(
    () => [
      {
        id: 'hud-logger:emit-info',
        label: 'HudLogger: Emit Info Event',
        action: () => {
          HObservabilityDefault.logger.info('hudson.logger.sample.info', {
            category: 'observability',
            data: { source: 'command', level: 'info' },
          });
        },
      },
      {
        id: 'hud-logger:emit-warning',
        label: 'HudLogger: Emit Warning Event',
        action: () => {
          HObservabilityDefault.logger.warn('hudson.logger.sample.warn', {
            category: 'observability',
            data: { source: 'command', level: 'warn' },
          });
        },
      },
      {
        id: 'hud-logger:clear',
        label: 'HudLogger: Clear Buffer',
        action: () => {
          HObservabilityDefault.flush();
          HObservabilityDefault.logger.info('hudson.logger.buffer_cleared', {
            category: 'observability',
            data: { source: 'command' },
          });
        },
      },
    ],
    [],
  );
}

export function useHudLoggerStatus(): { label: string; color: StatusColor } {
  const summary = useHudLoggerSummary(HObservabilityDefault, { maxEvents: MAX_EVENTS });

  if (summary.errors > 0) {
    return { label: 'Logs', color: 'red' };
  }

  if (summary.warnings > 0 || summary.activeSpans > 0) {
    return { label: 'Logs', color: 'amber' };
  }

  return { label: 'Logs', color: 'emerald' };
}

export function useHudLoggerLayoutMode() {
  return 'panel' as const;
}
