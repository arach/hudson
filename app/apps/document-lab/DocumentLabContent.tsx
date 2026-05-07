'use client';

import { TextDiffSurface, TextDocumentSurface } from 'hudsonkit';
import { useDocumentLab } from './DocumentLabProvider';

export function DocumentLabContent() {
  const {
    documents,
    diffs,
    activeDocument,
    activeDocumentId,
    activeMode,
    activeDiff,
    selectDocument,
    setActiveMode,
    updateActiveDocument,
    saveActiveDocument,
  } = useDocumentLab();

  return (
    <div className="flex h-full min-h-[calc(100vh-28px)] flex-col bg-[#070b0d] px-3 pb-3 pt-14">
      <div className="mb-2 flex shrink-0 gap-1 overflow-x-auto">
        {documents.map(document => (
          <button
            key={document.id}
            type="button"
            onClick={() => selectDocument(document.id)}
            className={`shrink-0 rounded border px-3 py-1.5 text-left transition-colors ${
              document.id === activeDocumentId
                ? 'border-cyan-300/24 bg-cyan-400/12 text-cyan-100'
                : 'border-white/[0.06] bg-white/[0.03] text-white/46 hover:bg-white/[0.055] hover:text-white/72'
            }`}
          >
            <span className="block text-[11px] font-medium">{document.title}</span>
            <span className="block font-mono text-[9px] uppercase tracking-wider text-white/30">{document.kind}</span>
          </button>
        ))}
        {diffs.map(diff => (
          <div
            key={diff.id}
            className="shrink-0 rounded border border-emerald-300/18 bg-emerald-400/10 px-3 py-1.5 text-left text-emerald-100"
          >
            <span className="block text-[11px] font-medium">{diff.title}</span>
            <span className="block font-mono text-[9px] uppercase tracking-wider text-emerald-200/45">diff</span>
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-3">
        <TextDocumentSurface
          key={activeDocument.id}
          document={activeDocument}
          mode={activeMode}
          onChange={updateActiveDocument}
          onSave={saveActiveDocument}
          onModeChange={setActiveMode}
          className="rounded"
        />
        <TextDiffSurface
          diff={activeDiff}
          className="rounded"
        />
      </div>
    </div>
  );
}
