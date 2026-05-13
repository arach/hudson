'use client';
import { useMemo } from 'react';
import type { CommandOption } from 'hudsonkit';
import { useLogo } from './LogoProvider';
import { useOptionalDataBus } from '../../shell/DataBusContext';

export function useLogoCommands(): CommandOption[] {
  const { templates, setVariant, resetDefaults, picks } = useLogo();
  const dataBus = useOptionalDataBus();
  return useMemo(() => {
    const cmds: CommandOption[] = templates.map(t => ({
      id: `logo:${t.id}`,
      label: `Logo: ${t.name}`,
      action: () => setVariant(t.id),
    }));
    cmds.push({ id: 'logo:reset', label: 'Logo: Reset defaults', action: resetDefaults });
    cmds.push({
      id: 'logo:animate-selected-variant',
      label: `Logo: Animate selected variant${picks.length === 1 ? '' : 's'}${picks.length > 0 ? ` (${picks.length})` : ''}`,
      action: () => {
        if (picks.length === 0) {
          console.warn('[logo] Select at least one matrix variant before animating.');
          return;
        }
        const pushed = dataBus?.pushDirect('logo-designer', 'animation-job', 'preframe-catalog', 'logo-animation-job');
        if (!pushed) {
          console.warn('[logo] Preframe animation port is not available. Start/register Preframe and try again.');
        }
      },
      shortcut: 'A',
    });
    return cmds;
  }, [dataBus, picks.length, resetDefaults, setVariant, templates]);
}

export function useLogoStatus() {
  const { params, templates } = useLogo();
  const tmpl = templates.find(t => t.id === params.variant);
  return {
    label: tmpl?.name?.toUpperCase() ?? 'UNKNOWN',
    color: 'emerald' as const,
  };
}
