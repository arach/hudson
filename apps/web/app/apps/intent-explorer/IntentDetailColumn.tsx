'use client';

import { ExternalLink, X } from 'hudsonkit/icons';
import { useExplorer } from './IntentProvider';
import { CATEGORY_COLORS } from './types';

export function IntentDetailColumn() {
  const {
    catalog,
    selectedIntentId,
    detailOpen,
    setDetailOpen,
    addFloatingCard,
  } = useExplorer();

  const entry = selectedIntentId ? catalog.index[selectedIntentId] : null;
  const intent = entry?.intent;
  const appId = entry?.appId;
  const categoryColors = intent ? CATEGORY_COLORS[intent.category] : '';

  return (
    <div
      className="shrink-0 border-l border-neutral-700/50 bg-neutral-900/60 overflow-hidden transition-all duration-200 ease-out"
      style={{
        width: detailOpen && intent ? 360 : 0,
        opacity: detailOpen && intent ? 1 : 0,
      }}
    >
      {intent && (
        <div className="w-[360px] h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
            <span className="text-[10px] font-mono text-neutral-300 tracking-widest uppercase">
              Detail
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => addFloatingCard(selectedIntentId!)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-emerald-400"
                title="Pop out to floating card"
              >
                <ExternalLink size={12} />
              </button>
              <button
                onClick={() => setDetailOpen(false)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-neutral-200"
                title="Close detail"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto frame-scrollbar p-4 space-y-4">
            {/* Title + category */}
            <div className="space-y-2">
              <div className="text-[13px] font-mono font-bold text-white tracking-wider">
                {intent.title}
              </div>
              <span
                className={`inline-block text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryColors}`}
              >
                {intent.category}
              </span>
            </div>

            <div className="h-px bg-neutral-600/50" />

            {/* Attributes */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px] font-mono">
              <div className="text-neutral-200">commandId</div>
              <div className="text-emerald-400 truncate">{intent.commandId}</div>

              <div className="text-neutral-200">app</div>
              <div className="text-white">{appId}</div>

              {intent.shortcut && (
                <>
                  <div className="text-neutral-200">shortcut</div>
                  <div>
                    <kbd className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-[11px] font-mono">
                      {intent.shortcut}
                    </kbd>
                  </div>
                </>
              )}

              {intent.dangerous && (
                <>
                  <div className="text-neutral-200">dangerous</div>
                  <div className="text-red-400">true</div>
                </>
              )}
            </div>

            <div className="h-px bg-neutral-600/50" />

            {/* Description */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
                Description
              </div>
              <div className="text-[11px] font-mono text-neutral-300 leading-relaxed">
                {intent.description}
              </div>
            </div>

            {/* Keywords */}
            {intent.keywords.length > 0 && (
              <>
                <div className="h-px bg-neutral-600/50" />
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
                    Keywords
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">
                    {intent.keywords.join(' \u00b7 ')}
                  </div>
                </div>
              </>
            )}

            {/* Params table */}
            {intent.params && intent.params.length > 0 && (
              <>
                <div className="h-px bg-neutral-600/50" />
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
                    Parameters
                  </div>
                  <div className="space-y-2">
                    {intent.params.map(p => (
                      <div key={p.name} className="bg-neutral-800/50 rounded px-3 py-2 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-mono text-emerald-400">{p.name}</span>
                          <span className="text-[10px] font-mono text-neutral-500">{p.type}</span>
                          {p.optional && (
                            <span className="text-[9px] font-mono text-neutral-600">optional</span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400">{p.description}</div>
                        {p.enum && (
                          <div className="text-[10px] font-mono text-neutral-500">
                            enum: {p.enum.join(' | ')}
                          </div>
                        )}
                        {p.default !== undefined && (
                          <div className="text-[10px] font-mono text-neutral-500">
                            default: {String(p.default)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
