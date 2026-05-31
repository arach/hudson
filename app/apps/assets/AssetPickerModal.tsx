'use client';

import { useState } from 'react';
import { Check, Download, X, Globe, ImageIcon, Code } from 'lucide-react';
import { useAssets } from './AssetsProvider';

export function AssetPickerModal() {
  const {
    discoveredImages,
    discoveredPageTitle,
    closePicker,
    importDiscovered,
    importing,
  } = useAssets();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!discoveredImages) return null;

  const toggle = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(discoveredImages.map(img => img.url)));
  };

  const selectNone = () => setSelected(new Set());

  const typeIcon = (type: 'img' | 'svg' | 'og') => {
    if (type === 'svg') return <Code size={9} />;
    if (type === 'og') return <Globe size={9} />;
    return <ImageIcon size={9} />;
  };

  const typeLabel = (type: 'img' | 'svg' | 'og') => {
    if (type === 'svg') return 'SVG';
    if (type === 'og') return 'OG';
    return 'IMG';
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) closePicker(); }}
    >
      <div className="w-[560px] max-h-[80%] flex flex-col rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-white/80">
              {discoveredImages.length} image{discoveredImages.length !== 1 ? 's' : ''} found
            </div>
            {discoveredPageTitle && (
              <div className="text-[10px] text-white/25 truncate mt-0.5">
                {discoveredPageTitle}
              </div>
            )}
          </div>
          <button
            onClick={closePicker}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Selection bar */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.04] text-[10px]">
          <button onClick={selectAll} className="text-cyan-400/60 hover:text-cyan-400 transition-colors">
            Select all
          </button>
          <button onClick={selectNone} className="text-white/25 hover:text-white/50 transition-colors">
            Clear
          </button>
          <div className="flex-1" />
          <span className="text-white/20">
            {selected.size} selected
          </span>
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {discoveredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/20 text-[12px]">
              No images found on this page
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {discoveredImages.map((img, i) => {
                const isSelected = selected.has(img.url);
                return (
                  <button
                    key={i}
                    onClick={() => toggle(img.url)}
                    className={`
                      relative aspect-square rounded-lg overflow-hidden border transition-all
                      ${isSelected
                        ? 'border-cyan-500/50 ring-1 ring-cyan-500/20 bg-cyan-500/5'
                        : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                      }
                    `}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.alt ?? ''}
                      className="w-full h-full object-contain p-1.5"
                      loading="lazy"
                    />

                    {/* Type badge */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-white/40">
                      {typeIcon(img.type)}
                      {typeLabel(img.type)}
                    </div>

                    {/* Selection check */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check size={11} className="text-black" />
                      </div>
                    )}

                    {/* Alt text */}
                    {img.alt && (
                      <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent text-[8px] text-white/50 truncate">
                        {img.alt}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
          <button
            onClick={closePicker}
            className="px-4 py-2 rounded-lg text-[12px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => importDiscovered(Array.from(selected))}
            disabled={selected.size === 0 || importing}
            className="px-4 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-[12px] font-medium hover:bg-cyan-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-2"
          >
            <Download size={12} />
            {importing
              ? 'Importing'
              : `Import ${selected.size || ''} image${selected.size !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
