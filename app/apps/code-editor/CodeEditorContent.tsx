'use client';

import { AlertCircle, Braces, FileCode2, Plus } from 'lucide-react';
import { TextDocumentSurface } from 'hudsonkit';
import { useCodeEditor } from './CodeEditorProvider';

export function CodeEditorContent() {
  const {
    activeDocument,
    activeMode,
    parseError,
    createDocument,
    setActiveMode,
    updateActiveDocument,
    saveActiveDocument,
  } = useCodeEditor();

  if (!activeDocument) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <FileCode2 size={24} className="text-muted-foreground/35" />
        <div className="text-[13px] text-muted-foreground">Open an object from a Hudson port or start a scratch buffer.</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => createDocument('json')}
            className="flex items-center gap-2 rounded border border-cyan-700/25 bg-cyan-700/10 px-3 py-2 text-[12px] font-medium text-cyan-700 transition-colors hover:bg-cyan-700/15 dark:border-cyan-300/15 dark:bg-cyan-400/10 dark:text-cyan-200"
          >
            <Braces size={13} />
            JSON
          </button>
          <button
            type="button"
            onClick={() => createDocument('javascript')}
            className="flex items-center gap-2 rounded border border-border/70 bg-card/70 px-3 py-2 text-[12px] font-medium text-foreground/76 transition-colors hover:bg-muted/50"
          >
            <Plus size={13} />
            JS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {parseError && activeMode === 'edit' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-700/20 bg-amber-700/8 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-300/15 dark:bg-amber-400/8 dark:text-amber-200/82">
          <AlertCircle size={13} className="shrink-0" />
          <span className="min-w-0 truncate font-mono">{parseError}</span>
        </div>
      )}
      <TextDocumentSurface
        key={activeDocument.id}
        document={activeDocument}
        mode={activeMode}
        onChange={updateActiveDocument}
        onSave={saveActiveDocument}
        onModeChange={setActiveMode}
        className="flex-1 border-0"
      />
    </div>
  );
}
