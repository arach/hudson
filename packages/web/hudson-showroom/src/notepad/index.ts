import { createElement } from 'react';
import { FileText, Plus } from 'lucide-react';
import type { HudsonApp } from 'hudsonkit';
import { NotepadProvider, useNotepad } from './NotepadProvider';
import { NotepadContent } from './NotepadContent';
import { NotepadLeftPanel } from './NotepadLeftPanel';
import {
  useNotepadCommands,
  useNotepadStatus,
  useNotepadNavCenter,
  useNotepadNavActions,
  useNotepadLayoutMode,
} from './hooks';
import { useNotepadPortOutput, useNotepadPortInput } from './ports';

// Header action: New Note button (rendered inside Provider scope)
function NotepadHeaderActions() {
  const { createNote } = useNotepad();
  return createElement('button', {
    onClick: createNote,
    className: 'p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/50 transition-colors',
    title: 'New Note',
  }, createElement(Plus, { size: 12 }));
}

export const notepadApp: HudsonApp = {
  id: 'notepad',
  name: 'Notepad',
  description: 'Markdown scratchpad for notes, findings, and documentation',
  mode: 'panel',

  Provider: NotepadProvider,

  leftPanel: {
    title: 'Notes',
    icon: createElement(FileText, { size: 12 }),
    headerActions: NotepadHeaderActions,
  },

  ports: {
    outputs: [
      { id: 'markdown', name: 'Markdown', dataType: 'text', description: 'Active note content as markdown' },
      { id: 'text', name: 'Plain Text', dataType: 'text', description: 'Active note content as plain text' },
    ],
    inputs: [
      { id: 'text', name: 'Text', dataType: 'text', description: 'Append text to the active note' },
      { id: 'json', name: 'JSON', dataType: 'json', description: 'Append formatted JSON as a code block' },
    ],
  },

  slots: {
    Content: NotepadContent,
    LeftPanel: NotepadLeftPanel,
  },

  hooks: {
    useCommands: useNotepadCommands,
    useStatus: useNotepadStatus,
    useNavCenter: useNotepadNavCenter,
    useNavActions: useNotepadNavActions,
    useLayoutMode: useNotepadLayoutMode,
    usePortOutput: useNotepadPortOutput,
    usePortInput: useNotepadPortInput,
  },
};
