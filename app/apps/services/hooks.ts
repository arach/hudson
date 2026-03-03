'use client';

import { useMemo } from 'react';
import type { CommandOption, StatusColor } from '@hudson/sdk';
import { useServices } from './ServicesProvider';

export function useServicesCommands(): CommandOption[] {
  const { catalog, records, executeAction } = useServices();

  return useMemo(() => {
    const cmds: CommandOption[] = [];

    for (const svc of catalog) {
      const status = records[svc.id]?.status;

      if (status !== 'running') {
        cmds.push({
          id: `services:start:${svc.id}`,
          label: `Start ${svc.name}`,
          action: () => executeAction(svc.id, 'start'),
        });
      }
      if (status === 'running') {
        cmds.push({
          id: `services:stop:${svc.id}`,
          label: `Stop ${svc.name}`,
          action: () => executeAction(svc.id, 'stop'),
        });
      }
      cmds.push({
        id: `services:check:${svc.id}`,
        label: `Check ${svc.name}`,
        action: () => executeAction(svc.id, 'check'),
      });
    }

    return cmds;
  }, [catalog, records, executeAction]);
}

export function useServicesStatus(): { label: string; color: StatusColor } {
  const { catalog, records } = useServices();

  return useMemo(() => {
    const total = catalog.length;
    if (total === 0) return { label: 'SERVICES', color: 'neutral' as StatusColor };

    const running = catalog.filter((s) => records[s.id]?.status === 'running').length;
    const hasError = catalog.some((s) => records[s.id]?.status === 'error');

    if (hasError) return { label: `SERVICES ${running}/${total}`, color: 'red' as StatusColor };
    if (running === total) return { label: `SERVICES ${running}/${total}`, color: 'emerald' as StatusColor };
    return { label: `SERVICES ${running}/${total}`, color: 'neutral' as StatusColor };
  }, [catalog, records]);
}
