'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clipboard,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { CanvasToolDock, PanZoomViewport, useShellLayout, type ViewportPan } from 'hudsonkit';
import { applyAnimatedFilter } from './engine/animation';
import { imageDataToPng } from './engine/imageData';
import { useImageProcess } from './ImageProcessProvider';
import type { ImageProcessAnimationSettings, SignalMosaicParams } from './types';
import type { ImageProcessProgram } from './programs/types';

const MIN_PREVIEW_ZOOM = 25;
const MAX_PREVIEW_ZOOM = 240;

function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return 'waiting for image';
  return `${width} x ${height}`;
}

function clampPreviewZoom(value: number): number {
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, value));
}

function dataUrlToPreviewImageData(dataUrl: string, maxDimension: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Canvas context is unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(ctx.getImageData(0, 0, width, height));
    };
    img.onerror = () => reject(new Error('Could not load preview image'));
    img.src = dataUrl;
  });
}

function useLiveFilterPreview({
  sourceDataUrl,
  program,
  params,
  animation,
}: {
  sourceDataUrl: string | null;
  program: ImageProcessProgram;
  params: SignalMosaicParams;
  animation: ImageProcessAnimationSettings;
}) {
  const [baseFrame, setBaseFrame] = useState<ImageData | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sourceDataUrl) return;

    void dataUrlToPreviewImageData(sourceDataUrl, Math.min(840, params.maxDimension)).then(source => {
      if (cancelled) return;
      const base = program.process(source, params);
      setBaseFrame(base);
      setPreviewDataUrl(imageDataToPng(base));
    }).catch(() => {
      if (!cancelled) setPreviewDataUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [params, program, sourceDataUrl]);

  useEffect(() => {
    if (!baseFrame) return;
    let frame = 0;
    let last = 0;
    const animated = animation.mode !== 'still' && animation.filter !== 'none' && animation.intensity > 0;

    const render = (now: number) => {
      if (now - last > 92) {
        setPreviewDataUrl(imageDataToPng(applyAnimatedFilter(baseFrame, animation, now, params.seed)));
        last = now;
      }
      if (animated) frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [animation, baseFrame, params.seed]);

  return previewDataUrl;
}

function PreviewPane({
  title,
  caption,
  src,
  active,
  zoom,
  pan,
  canPan,
  onPanChange,
  onZoomChange,
}: {
  title: string;
  caption: string;
  src: string | null;
  active?: boolean;
  zoom: number;
  pan: ViewportPan;
  canPan: boolean;
  onPanChange: (pan: ViewportPan) => void;
  onZoomChange: (zoom: number) => void;
}) {
  return (
    <div className="min-h-0 flex flex-col rounded-lg border border-border/70 bg-card/86 overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{title}</div>
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">{caption}</div>
        </div>
        {active ? <div className="h-2 w-2 rounded-full bg-success/80" /> : null}
      </div>
      {src ? (
        <PanZoomViewport
          pan={pan}
          scale={zoom / 100}
          onPanChange={onPanChange}
          onScaleChange={(scale) => onZoomChange(scale * 100)}
          panEnabled={canPan}
          minScale={MIN_PREVIEW_ZOOM / 100}
          maxScale={MAX_PREVIEW_ZOOM / 100}
          className="flex-1 min-h-[220px] bg-background/45"
        >
          <img
            src={src}
            alt={title}
            draggable={false}
            className="max-h-[calc(100%-24px)] max-w-[calc(100%-24px)] select-none object-contain"
          />
        </PanZoomViewport>
      ) : (
        <div className="flex-1 min-h-[220px] w-full flex items-center justify-center bg-background/45 text-[11px] text-muted-foreground/70">
          No output yet
        </div>
      )}
    </div>
  );
}

function RecipeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-[10px] text-foreground/70">{value}</span>
    </div>
  );
}

export function ImageProcessContent() {
  const {
    sourceDataUrl,
    processedDataUrl,
    sourceMeta,
    manifest,
    program,
    params,
    animation,
    status,
    error,
    view,
    previewZoom,
    setPreviewZoom,
    loadFile,
    loadClipboard,
    clearSource,
  } = useImageProcess();
  const { rightWidth } = useShellLayout();
  const liveFilteredDataUrl = useLiveFilterPreview({
    sourceDataUrl,
    program,
    params,
    animation,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewPan, setPreviewPan] = useState<ViewportPan>({ x: 0, y: 0 });
  const [handMode, setHandMode] = useState(true);
  const toolDockRight = rightWidth + 12;

  const resetPreviewView = useCallback(() => {
    setPreviewPan({ x: 0, y: 0 });
    setPreviewZoom(100);
  }, [setPreviewZoom]);

  const setClampedPreviewZoom = useCallback((zoom: number) => {
    setPreviewZoom(clampPreviewZoom(zoom));
  }, [setPreviewZoom]);

  const openFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const image = Array.from(files).find(file => file.type.startsWith('image/'));
    if (image) await loadFile(image);
  }, [loadFile]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    void handleFiles(event.dataTransfer.files);
  }, [handleFiles]);

  if (!sourceDataUrl) {
    return (
      <div
        className="relative flex min-h-screen flex-col items-center px-8 pb-20 pt-24 text-center"
        onDragOver={event => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className={`absolute inset-4 rounded-xl border border-dashed transition-colors ${
          dragOver ? 'border-success/45 bg-success/10' : 'border-border/70'
        }`} />
        <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/70 bg-card/86">
          <ImageIcon size={25} className="text-success" />
        </div>
        <div className="relative z-10 mt-4 text-[13px] text-foreground/72">Drop a hero image to process</div>
        <div className="relative z-10 mt-1 max-w-[360px] text-[11px] leading-5 text-muted-foreground">
          Run a source image through a reusable visual program, then export the PNG and recipe.
        </div>
        <div className="relative z-10 mt-5 flex items-center gap-2">
          <button
            onClick={openFile}
            className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2 text-[12px] font-medium text-success transition-colors hover:bg-success/20"
          >
            <Upload size={13} />
            Browse
          </button>
          <button
            onClick={() => { void loadClipboard(); }}
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/86 px-4 py-2 text-[12px] font-medium text-muted-foreground hover:bg-accent/8 transition-colors"
          >
            <Clipboard size={13} />
            Paste
          </button>
        </div>
        {error ? <div className="relative z-10 mt-4 text-[11px] text-destructive">{error}</div> : null}
        <CanvasToolDock
          right={toolDockRight}
          bottom={56}
          handMode={handMode}
          onHandModeChange={setHandMode}
          onResetView={resetPreviewView}
          scale={previewZoom / 100}
          onScaleChange={(scale) => setClampedPreviewZoom(scale * 100)}
          minScale={MIN_PREVIEW_ZOOM / 100}
          maxScale={MAX_PREVIEW_ZOOM / 100}
          zoomStep={0.15}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={event => {
            const files = event.target.files;
            if (files) void handleFiles(files);
            event.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden pb-8 pt-12"
      onDragOver={event => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <ImageIcon size={12} className="text-success" />
            <span className="truncate">{sourceMeta?.name ?? 'source-image'}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            {formatDimensions(sourceMeta?.width, sourceMeta?.height)}
            {manifest ? ` -> ${manifest.output.width} x ${manifest.output.height}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={clearSource}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/8 hover:text-destructive transition-colors"
            title="Clear source"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-[11px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="relative flex-1 min-h-0 overflow-hidden p-3">
        {view === 'recipe' ? (
          <div className="h-full overflow-auto rounded-lg border border-border/70 bg-card/86 p-4">
            <div className="mb-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Recipe</div>
              <div className="mt-1 text-[12px] text-foreground/76">{program.name}</div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/40 px-3">
                <RecipeRow label="Source" value={sourceMeta?.name ?? 'No image'} />
                <RecipeRow label="Input" value={formatDimensions(sourceMeta?.width, sourceMeta?.height)} />
                <RecipeRow
                  label="Output"
                  value={manifest ? `${manifest.output.width} x ${manifest.output.height}` : 'Waiting'}
                />
                <RecipeRow label="Seed" value={String(params.seed)} />
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 px-3">
                <RecipeRow label="Strength" value={`${params.strength}%`} />
                <RecipeRow label="Mosaic" value={String(params.mosaicSize)} />
                <RecipeRow label="Palette" value={`${params.paletteMix}%`} />
                <RecipeRow label="Edge" value={`${params.edgeBoost}%`} />
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 px-3">
                <RecipeRow label="Trace density" value={`${params.traceDensity}%`} />
                <RecipeRow label="Trace glow" value={`${params.traceGlow}%`} />
                <RecipeRow label="Routes" value={params.routeOverlay ? 'On' : 'Off'} />
                <RecipeRow label="Max dimension" value={String(params.maxDimension)} />
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 px-3">
                <RecipeRow label="Filter" value={animation.filter.replace('-', ' ')} />
                <RecipeRow label="Motion" value={animation.mode} />
                <RecipeRow label="Intensity" value={`${animation.intensity}%`} />
                <RecipeRow label="Speed" value={`${animation.speed}%`} />
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid h-full min-h-[520px] gap-3 ${
            view === 'compare' ? 'lg:grid-cols-2' : 'grid-cols-1'
          }`}>
            {(view === 'compare' || view === 'source') && (
              <PreviewPane
                title="Source"
                caption="Original image"
                src={sourceDataUrl}
                zoom={previewZoom}
                pan={previewPan}
                canPan={handMode}
                onPanChange={setPreviewPan}
                onZoomChange={setClampedPreviewZoom}
              />
            )}
            {(view === 'compare' || view === 'processed') && (
              <PreviewPane
                title="Processed"
                caption={`${program.name} + ${animation.filter === 'none' ? 'no filter' : animation.filter.replace('-', ' ')}`}
                src={liveFilteredDataUrl ?? processedDataUrl}
                active={status === 'done'}
                zoom={previewZoom}
                pan={previewPan}
                canPan={handMode}
                onPanChange={setPreviewPan}
                onZoomChange={setClampedPreviewZoom}
              />
            )}
          </div>
        )}
        <CanvasToolDock
          right={toolDockRight}
          bottom={56}
          handMode={handMode}
          onHandModeChange={setHandMode}
          onResetView={resetPreviewView}
          scale={previewZoom / 100}
          onScaleChange={(scale) => setClampedPreviewZoom(scale * 100)}
          minScale={MIN_PREVIEW_ZOOM / 100}
          maxScale={MAX_PREVIEW_ZOOM / 100}
          zoomStep={0.15}
        />
      </div>

      {status === 'processing' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/35 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-card/92 px-3 py-2 text-[11px] text-success">
            <Loader2 size={13} className="animate-spin" />
            Processing
          </div>
        </div>
      ) : null}

      {dragOver ? (
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-success/45 bg-success/10" />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const files = event.target.files;
          if (files) void handleFiles(files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
