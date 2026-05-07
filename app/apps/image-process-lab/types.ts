export interface ImageSourceMeta {
  name: string;
  width: number;
  height: number;
  size?: number;
  contentType?: string;
}

export interface SignalMosaicParams {
  strength: number;
  mosaicSize: number;
  paletteMix: number;
  traceDensity: number;
  traceGlow: number;
  edgeBoost: number;
  routeOverlay: boolean;
  maxDimension: number;
  seed: number;
}

export type ImageProcessProgramId = 'signal-mosaic' | 'field-dither' | 'soft-scan';
export type ImageProcessFilterMode = 'none' | 'signal-wash' | 'ct-scan' | 'print-lab';
export type ImageProcessAnimationMode = 'still' | 'sine' | 'drift' | 'scan';

export interface ImageProcessEffectMask {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
}

export interface ImageProcessAnimationSettings {
  filter: ImageProcessFilterMode;
  mode: ImageProcessAnimationMode;
  intensity: number;
  speed: number;
  primaryColor: string;
  secondaryColor: string;
  mask: ImageProcessEffectMask;
}

export interface ImageProcessManifest {
  app: 'image-process-lab';
  program: ImageProcessProgramId;
  createdAt: string;
  source: ImageSourceMeta | null;
  output: {
    width: number;
    height: number;
    mimeType: 'image/png';
  };
  params: SignalMosaicParams;
  animation: ImageProcessAnimationSettings;
}

export type ImageProcessStatus = 'empty' | 'ready' | 'processing' | 'done' | 'error';
export type ImageProcessView = 'compare' | 'source' | 'processed' | 'recipe';

export const DEFAULT_SIGNAL_MOSAIC_PARAMS: SignalMosaicParams = {
  strength: 62,
  mosaicSize: 5,
  paletteMix: 54,
  traceDensity: 42,
  traceGlow: 56,
  edgeBoost: 48,
  routeOverlay: true,
  maxDimension: 1400,
  seed: 17,
};

export const DEFAULT_IMAGE_PROCESS_ANIMATION: ImageProcessAnimationSettings = {
  filter: 'signal-wash',
  mode: 'sine',
  intensity: 46,
  speed: 42,
  primaryColor: '#10b981',
  secondaryColor: '#22d3ee',
  mask: {
    enabled: false,
    x: 50,
    y: 50,
    width: 72,
    height: 58,
    feather: 22,
  },
};
