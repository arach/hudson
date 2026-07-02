'use client';

import { useMemo } from 'react';
import type { CommandOption, StatusColor, SearchConfig } from 'hudsonkit';
import { useExplorer } from './IntentProvider';

export function useExplorerCommands(): CommandOption[] {
  return useMemo(() => [], []);
}

export function useExplorerStatus(): { label: string; color: StatusColor } {
  return { label: 'READY', color: 'emerald' };
}

export function useExplorerSearch(): SearchConfig {
  const { searchQuery, setSearchQuery } = useExplorer();
  return { value: searchQuery, onChange: setSearchQuery, placeholder: 'Search intents' };
}

export function useExplorerLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
