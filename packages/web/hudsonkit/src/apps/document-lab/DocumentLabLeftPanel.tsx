'use client';

import { Braces, FileCode2, FileText, Text } from 'lucide-react';
import type { HudsonTextDocument } from '../../index';
import { useDocumentLab } from './DocumentLabProvider';

export function DocumentLabLeftPanel() {
  const { documents, activeDocumentId, selectDocument, activeMode } = useDocumentLab();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/60 px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Documents</div>
      </div>
      <div className="flex-1 space-y-1 overflow-auto p-2">
        {documents.map(document => (
          <button
            key={document.id}
            type="button"
            onClick={() => selectDocument(document.id)}
            className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors ${
              document.id === activeDocumentId
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <DocumentIcon document={document} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">{document.title}</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground/70">{document.kind}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {activeMode}
      </div>
    </div>
  );
}

// Kind-coded icons use semantic status tokens (info/success/warning) so they
// flip on data-hudson-theme — the app's theme axis — instead of the OS-level
// prefers-color-scheme that bare Tailwind `dark:` keys off here.
function DocumentIcon({ document }: { document: HudsonTextDocument }) {
  if (document.kind === 'markdown') return <FileText size={14} className="mt-0.5 shrink-0 text-info" />;
  if (document.kind === 'code') return <FileCode2 size={14} className="mt-0.5 shrink-0 text-success" />;
  if (document.kind === 'raw') return <Braces size={14} className="mt-0.5 shrink-0 text-warning" />;
  return <Text size={14} className="mt-0.5 shrink-0 text-muted-foreground" />;
}
