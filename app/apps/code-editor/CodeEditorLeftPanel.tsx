'use client';

import { Braces, FileCode2, FileText, Lock, Plus, Trash2 } from 'lucide-react';
import type { HudsonCodeDocument } from './types';
import { useCodeEditor } from './CodeEditorProvider';

export function CodeEditorLeftPanel() {
  const {
    documents,
    activeDocumentId,
    activeMode,
    createDocument,
    deleteDocument,
    selectDocument,
  } = useCodeEditor();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Documents</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => createDocument('json')}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-accent"
              title="New JSON document"
            >
              <Braces size={12} />
            </button>
            <button
              type="button"
              onClick={() => createDocument('javascript')}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-accent"
              title="New JavaScript document"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-auto p-2">
        {documents.map(document => (
          <div
            key={document.id}
            className={`group flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors ${
              document.id === activeDocumentId
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <button
              type="button"
              onClick={() => selectDocument(document.id)}
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
            >
              <DocumentIcon document={document} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12px] font-medium">{document.title}</span>
                  {document.readOnly && <Lock size={10} className="shrink-0 text-warning" />}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground/70">
                  {document.source?.appId ?? document.uri ?? document.language ?? document.kind}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => deleteDocument(document.id)}
              className="mt-0.5 rounded p-1 text-transparent transition-colors group-hover:text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Close document"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {activeMode}
      </div>
    </div>
  );
}

// Kind-coded icons use semantic status tokens so they flip on data-hudson-theme.
// Mapping is shared with Document Lab by icon: Braces→warning, FileText→info,
// FileCode2→success.
function DocumentIcon({ document }: { document: HudsonCodeDocument }) {
  if (document.language === 'json') return <Braces size={14} className="mt-0.5 shrink-0 text-warning" />;
  if (document.kind === 'text' || document.kind === 'markdown') return <FileText size={14} className="mt-0.5 shrink-0 text-info" />;
  return <FileCode2 size={14} className="mt-0.5 shrink-0 text-success" />;
}
