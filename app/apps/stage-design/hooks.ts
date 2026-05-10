'use client';

import { createElement } from 'react';
import type { CommandOption } from 'hudsonkit';
import { Type, Image as ImageIcon, Globe, Hash, Eye, EyeOff, RotateCcw, Save } from 'lucide-react';
import { useWorkspaceDecor } from '../../shell/decor/WorkspaceDecorContext';
import { StageDesignHeaderActions, StageDesignNavCenter } from './StageDesignChrome';

export function useStageDesignCommands(): CommandOption[] {
  const decor = useWorkspaceDecor();
  return [
    {
      id: 'stage:add-text',
      label: 'Stage · Add text',
      icon: createElement(Type, { size: 14 }),
      action: () => decor.addItem('text'),
    },
    {
      id: 'stage:add-image',
      label: 'Stage · Add image',
      icon: createElement(ImageIcon, { size: 14 }),
      action: () => decor.addItem('image'),
    },
    {
      id: 'stage:add-web',
      label: 'Stage · Add web embed',
      icon: createElement(Globe, { size: 14 }),
      action: () => decor.addItem('web'),
    },
    {
      id: 'stage:add-step-card',
      label: 'Stage · Add step card',
      icon: createElement(Hash, { size: 14 }),
      action: () => decor.addItem('step-card'),
    },
    {
      id: 'stage:toggle-visible',
      label: decor.visible ? 'Stage · Hide all decorations' : 'Stage · Show all decorations',
      icon: createElement(decor.visible ? EyeOff : Eye, { size: 14 }),
      action: () => decor.setVisible(!decor.visible),
    },
    {
      id: 'stage:save-snapshot',
      label: 'Stage · Save snapshot',
      icon: createElement(Save, { size: 14 }),
      action: () => { void decor.saveSnapshot(); },
    },
    {
      id: 'stage:reset-seed',
      label: 'Stage · Reset to seed',
      icon: createElement(RotateCcw, { size: 14 }),
      action: () => decor.resetToSeed(),
    },
  ];
}

export function useStageDesignStatus() {
  const decor = useWorkspaceDecor();
  if (decor.saveError) {
    return { label: 'save failed', color: 'red' as const };
  }
  if (decor.isSaving) {
    return { label: 'saving snapshot', color: 'amber' as const };
  }
  if (!decor.visible) {
    return { label: `${decor.items.length} placed · hidden`, color: 'amber' as const };
  }
  return { label: `${decor.items.length} placed`, color: 'neutral' as const };
}

export function useStageDesignNavCenter() {
  return createElement(StageDesignNavCenter);
}

export function useStageDesignNavActions() {
  return createElement(StageDesignHeaderActions);
}

export function useStageDesignLayoutMode(): 'panel' {
  return 'panel';
}
