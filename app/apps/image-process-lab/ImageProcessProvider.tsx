'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { usePersistentState } from 'hudsonkit';
import { applyAnimatedFilter } from './engine/animation';
import { applyEffectMask, drawImageDataToCanvas, imageDataToPng } from './engine/imageData';
import { defaultImageProcessProgram, getImageProcessProgram } from './programs';
import {
  DEFAULT_IMAGE_PROCESS_ANIMATION,
  DEFAULT_SIGNAL_MOSAIC_PARAMS,
  type ImageProcessAnimationMode,
  type ImageProcessAnimationSettings,
  type ImageProcessFilterMode,
  type ImageProcessManifest,
  type ImageProcessProgramId,
  type ImageProcessStatus,
  type ImageProcessView,
  type ImageSourceMeta,
  type SignalMosaicParams,
} from './types';
import type { ImageProcessProgram } from './programs/types';

interface DecodedImage {
  imageData: ImageData;
  meta: ImageSourceMeta;
}

interface ImageProcessContextValue {
  sourceDataUrl: string | null;
  processedDataUrl: string | null;
  sourceMeta: ImageSourceMeta | null;
  manifest: ImageProcessManifest | null;
  programId: ImageProcessProgramId;
  program: ImageProcessProgram;
  setProgramId: (programId: ImageProcessProgramId) => void;
  animation: ImageProcessAnimationSettings;
  setAnimation: (animation: ImageProcessAnimationSettings) => void;
  setAnimationParam: <K extends keyof ImageProcessAnimationSettings>(key: K, value: ImageProcessAnimationSettings[K]) => void;
  params: SignalMosaicParams;
  status: ImageProcessStatus;
  error: string | null;
  exportStatus: ImageProcessExportStatus | null;
  view: ImageProcessView;
  setView: (view: ImageProcessView) => void;
  previewZoom: number;
  setPreviewZoom: (zoom: number) => void;
  processNow: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  loadDataUrl: (dataUrl: string, name?: string) => Promise<void>;
  loadClipboard: () => Promise<void>;
  clearSource: () => void;
  resetParams: () => void;
  setParam: <K extends keyof SignalMosaicParams>(key: K, value: SignalMosaicParams[K]) => void;
  downloadPng: () => void;
  downloadGif: () => Promise<void>;
  downloadLottie: () => Promise<void>;
  downloadSpriteSheet: () => Promise<void>;
  downloadEmbed: () => Promise<void>;
  downloadManifest: () => void;
}

const ImageProcessContext = createContext<ImageProcessContextValue | null>(null);
const ANIMATION_MODES: ImageProcessAnimationMode[] = ['still', 'sine', 'drift', 'scan'];
const FILTER_MODES: ImageProcessFilterMode[] = ['none', 'signal-wash', 'ct-scan', 'print-lab'];
const ANIMATION_EXPORT_DURATION_MS = 2000;
const GIF_EXPORT_FRAME_COUNT = 24;
const GIF_EXPORT_MAX_DIMENSION = 960;
const LOTTIE_EXPORT_FRAME_COUNT = 18;
const LOTTIE_EXPORT_MAX_DIMENSION = 720;
const SPRITE_EXPORT_FRAME_COUNT = 12;
const SPRITE_EXPORT_MAX_DIMENSION = 720;
type ImageProcessExportStatus = 'gif' | 'lottie' | 'sprite' | 'embed';

interface AnimationExportFrames {
  width: number;
  height: number;
  frameDurationMs: number;
  sourceDataUrl: string;
  processedDataUrl: string;
  frameDataUrls: string[];
  frames: ImageData[];
  source: ImageSourceMeta;
}

export function useImageProcess() {
  const ctx = useContext(ImageProcessContext);
  if (!ctx) throw new Error('useImageProcess must be used inside ImageProcessProvider');
  return ctx;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageSourceToCanvas(dataUrl: string, maxDimension: number, name: string): Promise<DecodedImage> {
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
      resolve({
        imageData: ctx.getImageData(0, 0, width, height),
        meta: {
          name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          contentType: dataUrl.match(/^data:([^;,]+)/)?.[1],
        },
      });
    };
    img.onerror = () => reject(new Error('Could not load image source'));
    img.src = dataUrl;
  });
}

function downloadText(filename: string, text: string, contentType = 'application/json') {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function exportFrameTimes(frameCount: number): number[] {
  if (frameCount <= 1) return [0];
  return Array.from({ length: frameCount }, (_, index) => (
    index * (ANIMATION_EXPORT_DURATION_MS / frameCount)
  ));
}

function createLottieDocument(exportFrames: AnimationExportFrames, name: string) {
  const frameRate = Math.round(1000 / exportFrames.frameDurationMs);
  const totalFrames = exportFrames.frameDataUrls.length;
  return {
    v: '5.12.2',
    fr: frameRate,
    ip: 0,
    op: totalFrames,
    w: exportFrames.width,
    h: exportFrames.height,
    nm: name,
    ddd: 0,
    assets: exportFrames.frameDataUrls.map((dataUrl, index) => ({
      id: `frame_${index}`,
      w: exportFrames.width,
      h: exportFrames.height,
      u: '',
      p: dataUrl,
      e: 1,
    })),
    layers: exportFrames.frameDataUrls.map((_, index) => ({
      ddd: 0,
      ind: index + 1,
      ty: 2,
      nm: `frame ${index + 1}`,
      refId: `frame_${index}`,
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [exportFrames.width / 2, exportFrames.height / 2, 0] },
        a: { a: 0, k: [exportFrames.width / 2, exportFrames.height / 2, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      ip: index,
      op: index + 1,
      st: 0,
      bm: 0,
    })),
  };
}

function createEmbedHtml(exportFrames: AnimationExportFrames, name: string): string {
  const payload = {
    name,
    width: exportFrames.width,
    height: exportFrames.height,
    duration: ANIMATION_EXPORT_DURATION_MS,
    frameDuration: exportFrames.frameDurationMs,
    source: exportFrames.sourceDataUrl,
    processed: exportFrames.processedDataUrl,
    frames: exportFrames.frameDataUrls,
  };
  const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${name}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f8f4; }
    hudson-signal-image { width: min(100vw, ${exportFrames.width}px); display: block; }
  </style>
</head>
<body>
  <hudson-signal-image></hudson-signal-image>
  <script>
(() => {
  const payload = ${payloadJson};
  class HudsonSignalImage extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._payload = null;
      this._frames = [];
      this._frameIndex = -1;
      this._raf = 0;
      this._playing = false;
      this._startedAt = 0;
    }

    connectedCallback() {
      if (!this.shadowRoot.innerHTML) {
        this.shadowRoot.innerHTML = \`
          <style>
            :host { display: block; aspect-ratio: var(--signal-aspect, 16 / 9); position: relative; overflow: hidden; }
            img, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
            img { filter: saturate(1.02) contrast(1.01); }
            canvas { opacity: var(--signal-opacity, .92); transition: opacity 240ms ease; mix-blend-mode: normal; }
          </style>
          <img part="base" alt="" />
          <canvas part="effect"></canvas>
        \`;
      }
      if (this._payload) this._renderPayload();
    }

    disconnectedCallback() {
      this.stop();
    }

    setPayload(nextPayload) {
      this._payload = nextPayload;
      this.style.setProperty('--signal-aspect', nextPayload.width + ' / ' + nextPayload.height);
      if (this.isConnected) this._renderPayload();
    }

    start() {
      if (!this._payload || this._playing) return;
      this._playing = true;
      this._startedAt = performance.now();
      const tick = (now) => {
        if (!this._playing) return;
        const elapsed = (now - this._startedAt) % this._payload.duration;
        const frame = Math.floor(elapsed / this._payload.frameDuration) % this._frames.length;
        this._drawFrame(frame);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    stop() {
      this._playing = false;
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    removeEffect() {
      this.stop();
      this.style.setProperty('--signal-opacity', '0');
      this._frameIndex = -1;
      const canvas = this.shadowRoot.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    showEffect() {
      this.style.setProperty('--signal-opacity', '.92');
      this._drawFrame(0);
      this.start();
    }

    setFrame(index) {
      if (!this._frames.length) return;
      this._drawFrame(Math.max(0, Math.min(this._frames.length - 1, index)));
    }

    _renderPayload() {
      const base = this.shadowRoot.querySelector('img');
      const canvas = this.shadowRoot.querySelector('canvas');
      canvas.width = this._payload.width;
      canvas.height = this._payload.height;
      base.src = this._payload.processed;
      this._frames = this._payload.frames.map(src => {
        const img = new Image();
        img.onload = () => this._drawFrame(0);
        img.src = src;
        return img;
      });
      this._drawFrame(0);
      this.start();
    }

    _drawFrame(index) {
      if (index === this._frameIndex || !this._frames[index]?.complete) return;
      const canvas = this.shadowRoot.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this._frames[index], 0, 0, canvas.width, canvas.height);
      this._frameIndex = index;
    }
  }

  if (!customElements.get('hudson-signal-image')) {
    customElements.define('hudson-signal-image', HudsonSignalImage);
  }
  const element = document.querySelector('hudson-signal-image');
  element.setPayload(payload);
  window.hudsonSignalImage = element;
})();
  </script>
</body>
</html>
`;
}

export function ImageProcessProvider({ children }: { children: ReactNode }) {
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [sourceMeta, setSourceMeta] = useState<ImageSourceMeta | null>(null);
  const [processedDataUrl, setProcessedDataUrl] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ImageProcessManifest | null>(null);
  const [programId, setProgramId] = usePersistentState<ImageProcessProgramId>(
    'image-process-lab.program',
    defaultImageProcessProgram.id,
  );
  const [params, setParams] = usePersistentState<SignalMosaicParams>(
    'image-process-lab.signal-mosaic.params',
    DEFAULT_SIGNAL_MOSAIC_PARAMS,
  );
  const [animation, setAnimation] = usePersistentState<ImageProcessAnimationSettings>(
    'image-process-lab.animation',
    DEFAULT_IMAGE_PROCESS_ANIMATION,
  );
  const [status, setStatus] = useState<ImageProcessStatus>('empty');
  const [exportStatus, setExportStatus] = useState<ImageProcessExportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = usePersistentState<ImageProcessView>('image-process-lab.view', 'compare');
  const [previewZoomRaw, setPreviewZoomRaw] = usePersistentState<number>('image-process-lab.preview-zoom', 100);
  const sourceNameRef = useRef('source-image');
  const runIdRef = useRef(0);
  const program = getImageProcessProgram(programId);
  const normalizedAnimation = useMemo<ImageProcessAnimationSettings>(() => ({
    ...DEFAULT_IMAGE_PROCESS_ANIMATION,
    ...animation,
    mask: {
      ...DEFAULT_IMAGE_PROCESS_ANIMATION.mask,
      ...animation.mask,
    },
    filter: FILTER_MODES.includes(animation.filter)
      ? animation.filter
      : DEFAULT_IMAGE_PROCESS_ANIMATION.filter,
    mode: ANIMATION_MODES.includes(animation.mode)
      ? animation.mode
      : DEFAULT_IMAGE_PROCESS_ANIMATION.mode,
  }), [animation]);

  const previewZoom = Math.max(25, Math.min(240, previewZoomRaw));
  const setPreviewZoom = useCallback((zoom: number) => {
    setPreviewZoomRaw(Math.max(25, Math.min(240, Math.round(zoom))));
  }, [setPreviewZoomRaw]);

  const processNow = useCallback(async () => {
    if (!sourceDataUrl) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setStatus('processing');
    setError(null);

    try {
      const decoded = await imageSourceToCanvas(sourceDataUrl, params.maxDimension, sourceNameRef.current);
      if (runId !== runIdRef.current) return;

      const processed = program.process(decoded.imageData, params);
      const output = applyEffectMask(decoded.imageData, processed, normalizedAnimation.mask);
      const png = imageDataToPng(output);
      const nextManifest: ImageProcessManifest = {
        app: 'image-process-lab',
        program: program.id,
        createdAt: new Date().toISOString(),
        source: decoded.meta,
        output: {
          width: output.width,
          height: output.height,
          mimeType: 'image/png',
        },
        params,
        animation: normalizedAnimation,
      };

      setSourceMeta(decoded.meta);
      setProcessedDataUrl(png);
      setManifest(nextManifest);
      setStatus('done');
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [normalizedAnimation, params, program, sourceDataUrl]);

  const loadDataUrl = useCallback(async (dataUrl: string, name = 'piped-image') => {
    sourceNameRef.current = name;
    setSourceDataUrl(dataUrl);
    setProcessedDataUrl(null);
    setManifest(null);
    setError(null);
    setStatus('ready');
    setView('compare');
  }, [setView]);

  const loadFile = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    sourceNameRef.current = file.name;
    setSourceDataUrl(dataUrl);
    setSourceMeta({
      name: file.name,
      width: 0,
      height: 0,
      size: file.size,
      contentType: file.type,
    });
    setProcessedDataUrl(null);
    setManifest(null);
    setError(null);
    setStatus('ready');
    setView('compare');
  }, [setView]);

  const loadClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const file = new File([blob], 'clipboard-image.png', { type: imageType });
        await loadFile(file);
        return;
      }
      throw new Error('Clipboard does not contain an image');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [loadFile]);

  const clearSource = useCallback(() => {
    runIdRef.current += 1;
    setSourceDataUrl(null);
    setSourceMeta(null);
    setProcessedDataUrl(null);
    setManifest(null);
    setError(null);
    setStatus('empty');
  }, []);

  const resetParams = useCallback(() => {
    setParams(DEFAULT_SIGNAL_MOSAIC_PARAMS);
  }, [setParams]);

  const setParam = useCallback(<K extends keyof SignalMosaicParams>(key: K, value: SignalMosaicParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, [setParams]);

  const setAnimationParam = useCallback(<K extends keyof ImageProcessAnimationSettings>(
    key: K,
    value: ImageProcessAnimationSettings[K],
  ) => {
    setAnimation(prev => ({ ...prev, [key]: value }));
  }, [setAnimation]);

  const downloadPng = useCallback(() => {
    if (!processedDataUrl) return;
    downloadDataUrl(`image-process-lab-${program.id}.png`, processedDataUrl);
  }, [processedDataUrl, program.id]);

  const buildAnimationExport = useCallback(async (
    frameCount: number,
    maxDimension: number,
  ): Promise<AnimationExportFrames> => {
    if (!sourceDataUrl) throw new Error('Load an image before exporting animation');

    const decoded = await imageSourceToCanvas(sourceDataUrl, maxDimension, sourceNameRef.current);
    const processedBase = program.process(decoded.imageData, params);
    const maskedBase = applyEffectMask(decoded.imageData, processedBase, normalizedAnimation.mask);
    const frameDurationMs = ANIMATION_EXPORT_DURATION_MS / frameCount;
    const frames = exportFrameTimes(frameCount).map(timeMs => (
      applyEffectMask(
        decoded.imageData,
        applyAnimatedFilter(processedBase, normalizedAnimation, timeMs, params.seed),
        normalizedAnimation.mask,
      )
    ));
    const frameDataUrls = frames.map(frame => imageDataToPng(frame));

    return {
      width: decoded.imageData.width,
      height: decoded.imageData.height,
      frameDurationMs,
      sourceDataUrl: imageDataToPng(decoded.imageData),
      processedDataUrl: imageDataToPng(maskedBase),
      frameDataUrls,
      frames,
      source: decoded.meta,
    };
  }, [normalizedAnimation, params, program, sourceDataUrl]);

  const runExport = useCallback(async (
    nextStatus: ImageProcessExportStatus,
    task: () => Promise<void>,
  ) => {
    setExportStatus(nextStatus);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportStatus(null);
    }
  }, []);

  const downloadGif = useCallback(async () => {
    await runExport('gif', async () => {
      const exportFrames = await buildAnimationExport(GIF_EXPORT_FRAME_COUNT, GIF_EXPORT_MAX_DIMENSION);
      const gif = GIFEncoder();
      const delay = Math.round(exportFrames.frameDurationMs);

      exportFrames.frames.forEach(frame => {
        const palette = quantize(frame.data, 256, { format: 'rgb565' });
        const index = applyPalette(frame.data, palette, 'rgb565');
        gif.writeFrame(index, exportFrames.width, exportFrames.height, {
          palette,
          delay,
          repeat: 0,
        });
      });
      gif.finish();
      const bytes = gif.bytes();
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);

      downloadBlob(
        `image-process-lab-${program.id}.gif`,
        new Blob([buffer], { type: 'image/gif' }),
      );
    });
  }, [buildAnimationExport, program.id, runExport]);

  const downloadLottie = useCallback(async () => {
    await runExport('lottie', async () => {
      const exportFrames = await buildAnimationExport(LOTTIE_EXPORT_FRAME_COUNT, LOTTIE_EXPORT_MAX_DIMENSION);
      const lottie = createLottieDocument(exportFrames, `image-process-lab-${program.id}`);
      downloadText(
        `image-process-lab-${program.id}.lottie-flipbook.json`,
        JSON.stringify(lottie, null, 2),
      );
    });
  }, [buildAnimationExport, program.id, runExport]);

  const downloadSpriteSheet = useCallback(async () => {
    await runExport('sprite', async () => {
      const exportFrames = await buildAnimationExport(SPRITE_EXPORT_FRAME_COUNT, SPRITE_EXPORT_MAX_DIMENSION);
      const columns = 4;
      const rows = Math.ceil(exportFrames.frames.length / columns);
      const canvas = document.createElement('canvas');
      canvas.width = exportFrames.width * columns;
      canvas.height = exportFrames.height * rows;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context is unavailable');

      const frameCanvas = document.createElement('canvas');
      exportFrames.frames.forEach((frame, index) => {
        drawImageDataToCanvas(frame, frameCanvas);
        const x = (index % columns) * exportFrames.width;
        const y = Math.floor(index / columns) * exportFrames.height;
        ctx.drawImage(frameCanvas, x, y);
      });

      const manifestText = JSON.stringify({
        app: 'image-process-lab',
        kind: 'sprite-sheet',
        program: program.id,
        source: exportFrames.source,
        frame: {
          width: exportFrames.width,
          height: exportFrames.height,
          count: exportFrames.frames.length,
          durationMs: ANIMATION_EXPORT_DURATION_MS,
          frameDurationMs: exportFrames.frameDurationMs,
          columns,
          rows,
        },
        params,
        animation: normalizedAnimation,
      }, null, 2);

      downloadDataUrl(`image-process-lab-${program.id}.sprite.png`, canvas.toDataURL('image/png'));
      downloadText(`image-process-lab-${program.id}.sprite.json`, manifestText);
    });
  }, [buildAnimationExport, normalizedAnimation, params, program.id, runExport]);

  const downloadEmbed = useCallback(async () => {
    await runExport('embed', async () => {
      const exportFrames = await buildAnimationExport(LOTTIE_EXPORT_FRAME_COUNT, LOTTIE_EXPORT_MAX_DIMENSION);
      const html = createEmbedHtml(exportFrames, `image-process-lab-${program.id}`);
      downloadText(`image-process-lab-${program.id}.embed.html`, html, 'text/html');
    });
  }, [buildAnimationExport, program.id, runExport]);

  const downloadManifest = useCallback(() => {
    if (!manifest) return;
    downloadText(`image-process-lab-${manifest.program}.recipe.json`, JSON.stringify(manifest, null, 2));
  }, [manifest]);

  useEffect(() => {
    if (!sourceDataUrl) return;
    const timer = window.setTimeout(() => {
      void processNow();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [processNow, sourceDataUrl]);

  const value = useMemo<ImageProcessContextValue>(() => ({
    sourceDataUrl,
    processedDataUrl,
    sourceMeta,
    manifest,
    programId,
    program,
    setProgramId,
    animation: normalizedAnimation,
    setAnimation,
    setAnimationParam,
    params,
    status,
    error,
    exportStatus,
    view,
    setView,
    previewZoom,
    setPreviewZoom,
    processNow,
    loadFile,
    loadDataUrl,
    loadClipboard,
    clearSource,
    resetParams,
    setParam,
    downloadPng,
    downloadGif,
    downloadLottie,
    downloadSpriteSheet,
    downloadEmbed,
    downloadManifest,
  }), [
    sourceDataUrl,
    processedDataUrl,
    sourceMeta,
    manifest,
    programId,
    program,
    setProgramId,
    normalizedAnimation,
    setAnimation,
    setAnimationParam,
    params,
    status,
    error,
    exportStatus,
    view,
    setView,
    previewZoom,
    setPreviewZoom,
    processNow,
    loadFile,
    loadDataUrl,
    loadClipboard,
    clearSource,
    resetParams,
    setParam,
    downloadPng,
    downloadGif,
    downloadLottie,
    downloadSpriteSheet,
    downloadEmbed,
    downloadManifest,
  ]);

  return (
    <ImageProcessContext.Provider value={value}>
      {children}
    </ImageProcessContext.Provider>
  );
}
