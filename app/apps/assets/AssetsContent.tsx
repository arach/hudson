'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Search,
  Loader2,
  ImageIcon,
  Trash2,
  X,
  ArrowRight,
  Upload,
  Clipboard,
} from 'lucide-react';
import { useAssets } from './AssetsProvider';
import { AssetPickerModal } from './AssetPickerModal';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetsContent() {
  const {
    assets,
    selectedAssetId,
    selectedAsset,
    selectAsset,
    removeAsset,
    clearAll,
    addFromFile,
    addFromDataUrl,
    url,
    setUrl,
    discovering,
    discoveryError,
    discoverFromUrl,
    showPicker,
  } = useAssets();

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag & drop ─────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type === 'image/svg+xml'
    );
    for (const file of files) {
      await addFromFile(file);
    }
  }, [addFromFile]);

  // ── Paste ───────────────────────────────────────────────────────────
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);

    // Check for image data first
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await addFromFile(file);
        return;
      }
    }

    // Check for text that looks like a data URL or image URL
    const text = e.clipboardData.getData('text/plain');
    if (text && text.startsWith('data:image/')) {
      e.preventDefault();
      await addFromDataUrl(text, 'pasted-image', 'paste');
    }
  }, [addFromFile, addFromDataUrl]);

  // ── URL submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await discoverFromUrl();
  };

  return (
    <div
      className="relative flex flex-col h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {/* URL bar */}
      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste URL to fetch images..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/30 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={discovering || !url.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-[12px] font-medium hover:bg-cyan-500/25 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-2"
          >
            {discovering ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Fetch
          </button>
        </div>
      </form>

      {/* Error bar */}
      {discoveryError && (
        <div className="px-4 py-2 text-[11px] text-red-400 bg-red-500/10 border-b border-red-500/20">
          {discoveryError}
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {assets.length === 0 ? (
          /* Empty state — big drop zone */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-dashed border-white/[0.08] flex items-center justify-center mb-4">
              <Upload size={24} className="text-white/10" />
            </div>
            <div className="text-[12px] text-white/30 mb-1">Drop files, paste, or fetch from URL</div>
            <div className="text-[10px] text-white/15 mb-4">PNG, JPEG, SVG, GIF, WebP</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
              >
                <Upload size={11} />
                Browse files
              </button>
              <button
                onClick={async () => {
                  try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                      const imageType = item.types.find(t => t.startsWith('image/'));
                      if (imageType) {
                        const blob = await item.getType(imageType);
                        const file = new File([blob], 'clipboard-image', { type: imageType });
                        await addFromFile(file);
                      }
                    }
                  } catch { /* clipboard API may not be available */ }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
              >
                <Clipboard size={11} />
                Paste
              </button>
            </div>
          </div>
        ) : (
          /* Library grid */
          <div className="p-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-white/15">
                {assets.length} asset{assets.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition-colors"
                  title="Add files"
                >
                  <Upload size={11} />
                </button>
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-colors"
                  title="Clear all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-2">
              {assets.map(asset => {
                const isSelected = asset.id === selectedAssetId;
                return (
                  <button
                    key={asset.id}
                    onClick={() => selectAsset(isSelected ? null : asset.id)}
                    className={`
                      group relative aspect-square rounded-lg overflow-hidden border transition-all
                      ${isSelected
                        ? 'border-cyan-500/50 ring-1 ring-cyan-500/20 bg-cyan-500/5'
                        : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                      }
                    `}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.displayUrl}
                      alt={asset.name}
                      className="w-full h-full object-contain p-1"
                    />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end opacity-0 group-hover:opacity-100">
                      <div className="w-full px-2 py-1.5 flex items-center justify-between">
                        <div className="text-[9px] text-white/60 truncate flex-1 mr-1">
                          {asset.name}
                        </div>
                        <div
                          role="button"
                          onClick={e => { e.stopPropagation(); removeAsset(asset.id); }}
                          className="p-0.5 rounded text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X size={10} />
                        </div>
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected asset info */}
            {selectedAsset && (
              <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 mb-1">
                  <ImageIcon size={10} />
                  <span className="truncate flex-1">{selectedAsset.name}</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-white/20">
                  <span>{selectedAsset.contentType}</span>
                  <span>{formatSize(selectedAsset.size)}</span>
                  {selectedAsset.width ? (
                    <span>{selectedAsset.width} x {selectedAsset.height}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded bg-cyan-500/5 border border-cyan-500/10 text-[9px] text-cyan-400/50">
                  <ArrowRight size={10} />
                  <span>Pipe this asset to Shaper</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async e => {
          const files = Array.from(e.target.files ?? []);
          for (const file of files) await addFromFile(file);
          e.target.value = '';
        }}
      />

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-cyan-500/5 border-2 border-dashed border-cyan-500/30 rounded-lg backdrop-blur-sm pointer-events-none">
          <div className="text-[14px] text-cyan-400/60 font-medium">
            Drop to add
          </div>
        </div>
      )}

      {/* Picker modal */}
      {showPicker && <AssetPickerModal />}
    </div>
  );
}
