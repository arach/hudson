'use client';

import { Braces, FileCode2, FileText, Text } from 'lucide-react';
import type { HudsonTextDocument } from 'hudsonkit';
import { useDocumentLab } from './DocumentLabProvider';

export function DocumentLabLeftPanel() {
  const { documents, activeDocumentId, selectDocument, activeMode } = useDocumentLab();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-white/[0.04] px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-white/22">Documents</div>
      </div>
      <div className="flex-1 space-y-1 overflow-auto p-2">
        {documents.map(document => (
          <button
            key={document.id}
            type="button"
            onClick={() => selectDocument(document.id)}
            className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors ${
              document.id === activeDocumentId
                ? 'bg-cyan-400/10 text-cyan-100'
                : 'text-white/48 hover:bg-white/[0.04] hover:text-white/72'
            }`}
          >
            <DocumentIcon document={document} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">{document.title}</span>
              <span className="block truncate font-mono text-[10px] text-white/28">{document.kind}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-white/[0.04] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/22">
        {activeMode}
      </div>
    </div>
  );
}

function DocumentIcon({ document }: { document: HudsonTextDocument }) {
  if (document.kind === 'markdown') return <FileText size={14} className="mt-0.5 shrink-0 text-cyan-300/58" />;
  if (document.kind === 'code') return <FileCode2 size={14} className="mt-0.5 shrink-0 text-emerald-300/58" />;
  if (document.kind === 'raw') return <Braces size={14} className="mt-0.5 shrink-0 text-amber-300/58" />;
  return <Text size={14} className="mt-0.5 shrink-0 text-white/35" />;
}
