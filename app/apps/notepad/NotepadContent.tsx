'use client';

import { useMemo } from 'react';
import { Plus, FileText, Eye, EyeOff } from 'lucide-react';
import { useNotepad } from './NotepadProvider';

// ---------------------------------------------------------------------------
// Simple markdown → HTML renderer (no dependencies)
// ---------------------------------------------------------------------------
function renderMarkdown(md: string): string {
  return md
    // Code blocks (``` ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-white/[0.03] border border-white/[0.06] rounded p-3 my-2 overflow-x-auto"><code class="text-[12px] font-mono text-emerald-300/70">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/[0.06] text-cyan-300/70 px-1 py-0.5 rounded text-[12px] font-mono">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-semibold text-white/80 mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-[16px] font-semibold text-white/85 mt-5 mb-1.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-[18px] font-bold text-white/90 mt-6 mb-2">$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white/80">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-white/60">$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del class="line-through text-white/30">$1</del>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-cyan-400/70 underline" target="_blank" rel="noopener">$1</a>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 text-white/60 list-disc">$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-cyan-500/30 pl-3 my-1 text-white/40 italic">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-white/[0.06] my-4" />')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p class="my-1.5 text-white/60 text-[13px] leading-relaxed">')
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^/, '<p class="my-1.5 text-white/60 text-[13px] leading-relaxed">')
    .replace(/$/, '</p>');
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

export function NotepadContent() {
  const {
    activeNote, showPreview, setShowPreview,
    updateContent, updateTitle, wordCount, charCount,
    createNote, notes,
  } = useNotepad();

  const renderedHtml = useMemo(
    () => activeNote?.content ? renderMarkdown(activeNote.content) : '',
    [activeNote?.content],
  );

  // No note selected
  if (!activeNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <FileText size={24} className="text-white/8" />
        <div className="text-white/10 text-[13px]">
          {notes.length === 0 ? 'Create a note to get started' : 'Select a note from the sidebar'}
        </div>
        <button
          onClick={createNote}
          className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 text-[12px] font-medium hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
        >
          <Plus size={13} /> New Note
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
        <input
          value={activeNote.title}
          onChange={e => updateTitle(e.target.value)}
          className="flex-1 bg-transparent text-[14px] font-medium text-white/80 outline-none placeholder:text-white/15"
          placeholder="Note title..."
        />
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`p-1.5 rounded transition-colors ${
            showPreview
              ? 'bg-cyan-500/15 text-cyan-400'
              : 'text-white/20 hover:text-white/40 hover:bg-white/[0.04]'
          }`}
          title={showPreview ? 'Edit mode' : 'Preview mode'}
        >
          {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-auto">
        {showPreview ? (
          <div
            className="px-5 py-4 prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <textarea
            value={activeNote.content}
            onChange={e => updateContent(e.target.value)}
            placeholder="Start writing... (supports markdown)"
            className="w-full h-full px-5 py-4 bg-transparent text-[13px] text-white/70 font-mono leading-relaxed outline-none resize-none placeholder:text-white/10"
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-white/[0.04] flex items-center gap-3 text-[10px] font-mono text-white/15">
        <span>{wordCount} words</span>
        <span className="text-white/8">|</span>
        <span>{charCount} chars</span>
      </div>
    </div>
  );
}
