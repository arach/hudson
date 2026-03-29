'use client';

import { useMemo, createElement } from 'react';
import type { CommandOption, StatusColor } from '@hudson/sdk';
import { useNotepad } from './NotepadProvider';

// ---------------------------------------------------------------------------
// useCommands
// ---------------------------------------------------------------------------
export function useNotepadCommands(): CommandOption[] {
  const { createNote, showPreview, setShowPreview } = useNotepad();

  return useMemo<CommandOption[]>(() => [
    { id: 'notepad:new', label: 'New Note', action: createNote, shortcut: 'Cmd+N' },
    {
      id: 'notepad:toggle-preview',
      label: showPreview ? 'Switch to Editor' : 'Switch to Preview',
      action: () => setShowPreview(!showPreview),
      shortcut: 'Cmd+P',
    },
  ], [createNote, showPreview, setShowPreview]);
}

// ---------------------------------------------------------------------------
// useStatus
// ---------------------------------------------------------------------------
export function useNotepadStatus(): { label: string; color: StatusColor } {
  const { notes, activeNote } = useNotepad();
  if (!activeNote) return { label: `${notes.length} notes`, color: 'neutral' };
  return { label: `${notes.length} notes`, color: 'emerald' };
}

// ---------------------------------------------------------------------------
// useNavCenter
// ---------------------------------------------------------------------------
export function useNotepadNavCenter() {
  const { showPreview } = useNotepad();
  return createElement('span', {
    className: 'text-[10px] font-mono text-neutral-500 uppercase tracking-wider',
  }, showPreview ? 'Preview' : 'Edit');
}

// ---------------------------------------------------------------------------
// useNavActions
// ---------------------------------------------------------------------------
export function useNotepadNavActions() {
  const { activeNote, wordCount } = useNotepad();
  if (!activeNote) return null;
  return createElement('span', {
    className: 'text-[11px] font-mono text-neutral-400',
  }, activeNote.title);
}

// ---------------------------------------------------------------------------
// useLayoutMode
// ---------------------------------------------------------------------------
export function useNotepadLayoutMode(): 'canvas' | 'panel' {
  return 'panel';
}
