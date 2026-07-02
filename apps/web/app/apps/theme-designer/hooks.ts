'use client';

import { createElement, useMemo } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useThemeDesigner } from './ThemeDesignerProvider';

export function useThemeDesignerCommands(): CommandOption[] {
  const designer = useThemeDesigner();

  return useMemo<CommandOption[]>(() => [
    {
      id: 'theme-designer:open',
      label: 'Open Theme Designer',
      section: 'Theme Designer',
      action: () => {
        window.location.hash = 'focus=theme-designer';
      },
    },
    {
      id: 'theme-designer:copy-css',
      label: 'Copy Theme CSS Block',
      section: 'Theme Designer',
      action: () => { void designer.copyCss(); },
    },
    {
      id: 'theme-designer:save-template',
      label: 'Save Theme Template to tokens.css',
      section: 'Theme Designer',
      action: () => { void designer.saveTemplate(); },
    },
    ...designer.templates.flatMap(template => ([
      {
        id: `theme-designer:select:${template.id}:dark`,
        label: `Theme Designer: ${template.id} dark`,
        section: 'Theme Designer',
        action: () => {
          designer.setSelectedTemplateId(template.id);
          designer.setSelectedMode('dark');
        },
      },
      {
        id: `theme-designer:select:${template.id}:light`,
        label: `Theme Designer: ${template.id} light`,
        section: 'Theme Designer',
        action: () => {
          designer.setSelectedTemplateId(template.id);
          designer.setSelectedMode('light');
        },
      },
    ])),
  ], [designer]);
}

export function useThemeDesignerStatus(): { label: string; color: StatusColor } {
  const { changedKeys, selectedTemplateId, selectedMode } = useThemeDesigner();
  if (changedKeys.length > 0) return { label: `${changedKeys.length} edits · ${selectedMode}`, color: 'amber' };
  return { label: `${selectedTemplateId} · ${selectedMode}`, color: 'emerald' };
}

export function useThemeDesignerNavCenter() {
  const { selectedTemplateId, selectedMode } = useThemeDesigner();
  return createElement('span', {
    className: 'font-mono text-[10px] uppercase tracking-wider text-muted-foreground',
  }, `${selectedTemplateId} / ${selectedMode}`);
}

export function useThemeDesignerNavActions() {
  const { changedKeys, saveStatus } = useThemeDesigner();
  return createElement('span', {
    className: `font-mono text-[10px] uppercase tracking-wider ${changedKeys.length > 0 ? 'text-warning' : 'text-muted-foreground'}`,
  }, saveStatus);
}
