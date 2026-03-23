'use client';
import { useMemo } from 'react';
import type { CommandOption } from '@hudson/sdk';
import { useLogo } from './LogoProvider';

export function useLogoCommands(): CommandOption[] {
  const { templates, setVariant, resetDefaults } = useLogo();
  return useMemo(() => {
    const cmds: CommandOption[] = templates.map(t => ({
      id: `logo:${t.id}`,
      label: `Logo: ${t.name}`,
      action: () => setVariant(t.id),
    }));
    cmds.push({ id: 'logo:reset', label: 'Logo: Reset defaults', action: resetDefaults });
    return cmds;
  }, [templates, setVariant, resetDefaults]);
}

export function useLogoStatus() {
  const { params, templates } = useLogo();
  const tmpl = templates.find(t => t.id === params.variant);
  return {
    label: tmpl?.name?.toUpperCase() ?? 'UNKNOWN',
    color: 'emerald' as const,
  };
}
