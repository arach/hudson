'use client';

import { useCallback } from 'react';
import { useNotepad } from './NotepadProvider';

// ---------------------------------------------------------------------------
// usePortOutput — export the active note's content
// ---------------------------------------------------------------------------
export function useNotepadPortOutput() {
  const { activeNote } = useNotepad();

  return useCallback((portId: string): unknown | null => {
    if (!activeNote) return null;
    if (portId === 'markdown') return activeNote.content;
    if (portId === 'text') return activeNote.content;
    return null;
  }, [activeNote]);
}

// ---------------------------------------------------------------------------
// usePortInput — receive text/data to append to the active note
// ---------------------------------------------------------------------------
export function useNotepadPortInput() {
  const { appendContent } = useNotepad();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'text' && typeof data === 'string') {
      appendContent(data);
    }
    if (portId === 'json') {
      // Auto-format JSON as a code block
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      appendContent('```json\n' + text + '\n```');
    }
  }, [appendContent]);
}
