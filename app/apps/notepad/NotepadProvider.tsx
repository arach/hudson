'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { usePersistentState } from '@hudson/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteEntry {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newNote(): NoteEntry {
  return {
    id: newId(),
    title: 'Untitled',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface NotepadContextValue {
  notes: NoteEntry[];
  activeNoteId: string | null;
  activeNote: NoteEntry | null;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;

  createNote: () => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string) => void;
  updateContent: (content: string) => void;
  updateTitle: (title: string) => void;
  appendContent: (text: string) => void;

  wordCount: number;
  charCount: number;
}

const NotepadContext = createContext<NotepadContextValue | null>(null);

export function useNotepad() {
  const ctx = useContext(NotepadContext);
  if (!ctx) throw new Error('useNotepad must be used inside NotepadProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NotepadProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = usePersistentState<NoteEntry[]>('notepad.notes', []);
  const [activeNoteId, setActiveNoteId] = usePersistentState<string | null>('notepad.active', null);
  const [showPreview, setShowPreview] = useState(false);

  const activeNote = useMemo(
    () => notes.find(n => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  const createNote = useCallback(() => {
    const note = newNote();
    setNotes(prev => [note, ...prev]);
    setActiveNoteId(note.id);
  }, [setNotes, setActiveNoteId]);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setActiveNoteId(prev => prev === id ? null : prev);
  }, [setNotes, setActiveNoteId]);

  const selectNote = useCallback((id: string) => {
    setActiveNoteId(id);
  }, [setActiveNoteId]);

  const updateContent = useCallback((content: string) => {
    setNotes(prev => prev.map(n =>
      n.id === activeNoteId ? { ...n, content, updatedAt: Date.now() } : n
    ));
  }, [activeNoteId, setNotes]);

  const updateTitle = useCallback((title: string) => {
    setNotes(prev => prev.map(n =>
      n.id === activeNoteId ? { ...n, title, updatedAt: Date.now() } : n
    ));
  }, [activeNoteId, setNotes]);

  const appendContent = useCallback((text: string) => {
    if (activeNoteId) {
      setNotes(prev => prev.map(n =>
        n.id === activeNoteId
          ? { ...n, content: n.content + (n.content ? '\n\n' : '') + text, updatedAt: Date.now() }
          : n
      ));
    } else {
      // Create a new note with the received content
      const note: NoteEntry = {
        id: newId(),
        title: 'Imported',
        content: text,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setNotes(prev => [note, ...prev]);
      setActiveNoteId(note.id);
    }
  }, [activeNoteId, setNotes, setActiveNoteId]);

  const wordCount = useMemo(
    () => activeNote?.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0,
    [activeNote?.content],
  );
  const charCount = useMemo(() => activeNote?.content.length ?? 0, [activeNote?.content]);

  const value: NotepadContextValue = {
    notes, activeNoteId, activeNote, showPreview, setShowPreview,
    createNote, deleteNote, selectNote, updateContent, updateTitle, appendContent,
    wordCount, charCount,
  };

  return (
    <NotepadContext.Provider value={value}>
      {children}
    </NotepadContext.Provider>
  );
}
