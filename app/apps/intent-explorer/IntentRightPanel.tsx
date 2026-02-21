'use client';

import { useExplorer } from './IntentProvider';
import { CATEGORY_COLORS } from './types';

export function IntentRightPanel() {
  const { catalog, selectedIntentId } = useExplorer();

  if (!selectedIntentId) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Inspector
        </div>
        <div className="text-[11px] font-mono text-neutral-500">
          Select an intent to inspect
        </div>
      </div>
    );
  }

  const entry = catalog.index[selectedIntentId];
  if (!entry) return null;

  const { intent, appId } = entry;
  const categoryColors = CATEGORY_COLORS[intent.category];

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full frame-scrollbar">
      {/* Title */}
      <div className="space-y-1">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Intent
        </div>
        <div className="text-[13px] font-mono font-bold text-white tracking-wider">
          {intent.title}
        </div>
      </div>

      <div className="h-px bg-neutral-600/50" />

      {/* Attributes grid */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Attributes
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px] font-mono">
          <div className="text-neutral-200">commandId</div>
          <div className="text-emerald-400 font-mono truncate">{intent.commandId}</div>

          <div className="text-neutral-200">app</div>
          <div className="text-white">{appId}</div>

          <div className="text-neutral-200">category</div>
          <div>
            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryColors}`}>
              {intent.category}
            </span>
          </div>

          {intent.shortcut && (
            <>
              <div className="text-neutral-200">shortcut</div>
              <div>
                <span className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-[11px] font-mono">
                  {intent.shortcut}
                </span>
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

      <div className="h-px bg-neutral-600/50" />

      {/* Keywords */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-neutral-200 tracking-widest uppercase">
          Keywords
        </div>
        <div className="text-[11px] font-mono text-neutral-400">
          {intent.keywords.join(' \u00b7 ')}
        </div>
      </div>

      {/* Params table (if any) */}
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
  );
}
