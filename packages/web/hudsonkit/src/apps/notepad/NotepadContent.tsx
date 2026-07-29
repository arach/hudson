'use client';

import { Plus, FileText, Eye, EyeOff } from '../../icons';
import { TextDocumentSurface, createHudsonTextDocument, type TextDocumentMode } from '../../index';
import { useNotepad } from './NotepadProvider';

export function NotepadContent() {
  const {
    activeNote,
    showPreview,
    setShowPreview,
    updateContent,
    updateTitle,
    wordCount,
    charCount,
    createNote,
    notes,
  } = useNotepad();

  if (!activeNote) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <FileText size={24} className="text-white/8" />
        <div className="text-[13px] text-white/10">
          {notes.length === 0 ? 'Create a note to get started' : 'Select a note from the sidebar'}
        </div>
        <button
          onClick={createNote}
          className="flex items-center gap-2 rounded-lg border border-cyan-500/15 bg-cyan-500/10 px-4 py-2 text-[12px] font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
        >
          <Plus size={13} /> New Note
        </button>
      </div>
    );
  }

  const document = createHudsonTextDocument({
    id: activeNote.id,
    title: `${activeNote.title || 'Untitled'}.md`,
    uri: `hudson://notepad/${activeNote.id}`,
    mediaType: 'text/markdown',
    value: activeNote.content,
  });

  const mode: TextDocumentMode = showPreview ? 'preview' : 'edit';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
        <input
          value={activeNote.title}
          onChange={event => updateTitle(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-white/80 outline-none placeholder:text-white/15"
          placeholder="Note title"
        />
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`rounded p-1.5 transition-colors ${
            showPreview
              ? 'bg-cyan-500/15 text-cyan-400'
              : 'text-white/20 hover:bg-white/[0.04] hover:text-white/40'
          }`}
          title={showPreview ? 'Edit mode' : 'Preview mode'}
        >
          {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <TextDocumentSurface
        key={activeNote.id}
        document={document}
        mode={mode}
        onChange={updateContent}
        onSave={updateContent}
        onModeChange={nextMode => setShowPreview(nextMode === 'preview')}
        showHeader={false}
        className="flex-1 border-0"
      />

      <div className="flex items-center gap-3 border-t border-white/[0.04] px-4 py-1.5 font-mono text-[10px] text-white/15">
        <span>{wordCount} words</span>
        <span className="text-white/8">|</span>
        <span>{charCount} chars</span>
      </div>
    </div>
  );
}
