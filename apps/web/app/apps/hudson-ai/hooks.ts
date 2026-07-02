'use client';

import type { CommandOption } from 'hudsonkit';
import { useHudsonAIApp } from './HudsonAIProvider';

export function useHudsonAICommands(): CommandOption[] {
  return [];
}

export function useHudsonAIStatus() {
  const { resolvedProvider } = useHudsonAIApp();

  return {
    label: resolvedProvider.toUpperCase().slice(0, 12),
    color: 'neutral' as const,
  };
}
