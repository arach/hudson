'use client';

import { Trash2, FileText } from 'lucide-react';
import { useNotepad } from './NotepadProvider';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function preview(content: string, maxLen = 60): string {
  const line = content.replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim();
  return line.length > maxLen ? line.slice(0, maxLen - 3) + '...' : line;
}

export function NotepadLeftPanel() {
  const { notes, activeNoteId, selectNote, deleteNote } = useNotepad();

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground/60 text-[11px]">
        No notes yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto py-1">
      {notes.map(note => (
        <div
          key={note.id}
          onClick={() => selectNote(note.id)}
          className={`group px-3 py-2 cursor-pointer transition-colors border-l-2 ${
            note.id === activeNoteId
              ? 'bg-accent/5 border-l-accent/50'
              : 'border-l-transparent hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText size={11} className={note.id === activeNoteId ? 'text-accent' : 'text-muted-foreground/60'} />
            <span className={`text-[12px] font-medium truncate flex-1 ${
              note.id === activeNoteId ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {note.title}
            </span>
            <button
              onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
            >
              <Trash2 size={10} />
            </button>
          </div>
          {note.content && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 ml-[19px] truncate">
              {preview(note.content)}
            </div>
          )}
          <div className="text-[9px] text-muted-foreground/60 mt-0.5 ml-[19px]">
            {timeAgo(note.updatedAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
