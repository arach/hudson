'use client';

import { useMemo, type ReactNode, createElement } from 'react';
import { Move, LayoutList, LayoutGrid } from 'lucide-react';
import type { CommandOption } from 'hudsonkit';
import type { StatusColor, SearchConfig } from 'hudsonkit';
import { useDocs } from './DocsProvider';
import { ViewModeToggle } from './components';

export function useDocsCommands(): CommandOption[] {
  const { setViewMode, playSound } = useDocs();

  return useMemo(() => [
    { id: 'view-canvas', label: 'View: Canvas', shortcut: 'Cmd+1', icon: createElement(Move, { size: 14 }), action: () => { setViewMode('canvas'); playSound('click'); } },
    { id: 'view-list', label: 'View: List', shortcut: 'Cmd+2', icon: createElement(LayoutList, { size: 14 }), action: () => { setViewMode('list'); playSound('click'); } },
    { id: 'view-tiles', label: 'View: Tiles', shortcut: 'Cmd+3', icon: createElement(LayoutGrid, { size: 14 }), action: () => { setViewMode('tiles'); playSound('click'); } },
  ], [setViewMode, playSound]);
}

export function useDocsStatus(): { label: string; color: StatusColor } {
  return { label: 'READY', color: 'amber' };
}

export function useDocsSearch(): SearchConfig {
  const { searchValue, setSearchValue } = useDocs();
  return { value: searchValue, onChange: setSearchValue, placeholder: 'Filter...' };
}

export function useDocsNavCenter(): ReactNode | null {
  // View mode is switchable via Cmd+1/2/3 and the command palette
  return null;
}

export function useDocsNavActions(): ReactNode | null {
  return null; // Mute button is shell-level
}

export function useDocsLayoutMode(): 'canvas' | 'panel' {
  const { viewMode } = useDocs();
  return viewMode === 'canvas' ? 'canvas' : 'panel';
}
