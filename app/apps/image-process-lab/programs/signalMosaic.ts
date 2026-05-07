import { bayer8, hash2d } from '../engine/dither';
import { clampByte, mixRgb, nearestSignalColor, type Rgb } from '../engine/palette';
import type { SignalMosaicParams } from '../types';
import { edgeAmount, luminance, mosaicSource } from './programUtils';
import type { ImageProcessProgram } from './types';

function routeTrace(x: number, y: number, width: number, height: number, params: SignalMosaicParams): number {
  if (!params.routeOverlay) return 0;

  const cell = Math.max(7, params.mosaicSize * 3);
  const laneX = Math.floor(x / cell);
  const laneY = Math.floor(y / cell);
  const density = params.traceDensity / 100;
  const localX = x % cell;
  const localY = y % cell;
  const line = localX <= 1 || localY <= 1;
  if (!line) return 0;

  const field = hash2d(laneX, laneY, params.seed);
  const edgeFade = Math.min(x, y, width - 1 - x, height - 1 - y) < cell ? 0.35 : 1;
  return field < density * 0.18 ? edgeFade : 0;
}

function processSignalMosaic(input: ImageData, params: SignalMosaicParams): ImageData {
  const { width, height } = input;
  const source = mosaicSource(input, Math.max(1, Math.round(params.mosaicSize)));
  const output = new ImageData(width, height);
  const strength = params.strength / 100;
  const paletteMix = params.paletteMix / 100;
  const edgeBoost = params.edgeBoost / 100;
  const traceGlow = params.traceGlow / 100;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const base: Rgb = { r: source[i], g: source[i + 1], b: source[i + 2] };
      const lum = luminance(base.r, base.g, base.b);
      const edge = edgeAmount(input.data, width, height, x, y);
      const dither = bayer8(x, y) - 0.5;
      const signal = routeTrace(x, y, width, height, params);
      const target = nearestSignalColor(lum + dither * 34 + edge * 24);
      const mixed = mixRgb(base, target, Math.min(0.82, strength * paletteMix + edge * edgeBoost * 0.28));

      const packet = hash2d(Math.floor(x / 3), Math.floor(y / 3), params.seed + 31);
      const ditherSpark = packet < (params.traceDensity / 100) * 0.025 && dither > 0.18 ? 1 : 0;
      const glow = Math.max(signal, ditherSpark) * traceGlow;

      output.data[i] = clampByte(mixed.r + glow * 18);
      output.data[i + 1] = clampByte(mixed.g + glow * 74);
      output.data[i + 2] = clampByte(mixed.b + glow * 42);
      output.data[i + 3] = input.data[i + 3];
    }
  }

  return output;
}

export const signalMosaicProgram: ImageProcessProgram = {
  id: 'signal-mosaic',
  name: 'Signal Mosaic',
  description: 'A deterministic mosaic, dither, and green trace pass for product hero images.',
  process: processSignalMosaic,
};
