import { bayer8, hash2d } from '../engine/dither';
import { clampByte, mixRgb, type Rgb } from '../engine/palette';
import type { SignalMosaicParams } from '../types';
import { edgeAmount, luminance, mosaicSource } from './programUtils';
import type { ImageProcessProgram } from './types';

function scanColor(lum: number): Rgb {
  if (lum < 56) return { r: 15, g: 25, b: 27 };
  if (lum < 112) return { r: 32, g: 76, b: 66 };
  if (lum < 168) return { r: 98, g: 151, b: 128 };
  if (lum < 220) return { r: 208, g: 225, b: 214 };
  return { r: 250, g: 251, b: 246 };
}

function processSoftScan(input: ImageData, params: SignalMosaicParams): ImageData {
  const { width, height } = input;
  const block = Math.max(1, Math.round(params.mosaicSize * 0.55));
  const source = mosaicSource(input, block);
  const output = new ImageData(width, height);
  const strength = params.strength / 100;
  const paletteMix = params.paletteMix / 100;
  const edgeBoost = params.edgeBoost / 100;
  const traceGlow = params.traceGlow / 100;
  const traceDensity = params.traceDensity / 100;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const base: Rgb = { r: source[i], g: source[i + 1], b: source[i + 2] };
      const edge = edgeAmount(input.data, width, height, x, y);
      const dither = (bayer8(x, y) - 0.5) * 28;
      const scan = y % Math.max(4, block * 2) === 0 ? -10 : 0;
      const lum = luminance(base.r, base.g, base.b) + dither + scan + edge * 36;
      const target = scanColor(lum);
      const mixed = mixRgb(base, target, Math.min(0.72, strength * 0.34 + paletteMix * 0.36 + edge * edgeBoost * 0.34));

      const lane = params.routeOverlay && (x % Math.max(14, block * 8) <= 1 || y % Math.max(14, block * 8) <= 1);
      const packet = hash2d(Math.floor(x / Math.max(3, block)), Math.floor(y / Math.max(3, block)), params.seed + 307);
      const signal = (lane && packet < traceDensity * 0.28 ? 1 : 0) * traceGlow;

      output.data[i] = clampByte(mixed.r + signal * 14);
      output.data[i + 1] = clampByte(mixed.g + signal * 72);
      output.data[i + 2] = clampByte(mixed.b + signal * 58);
      output.data[i + 3] = input.data[i + 3];
    }
  }

  return output;
}

export const softScanProgram: ImageProcessProgram = {
  id: 'soft-scan',
  name: 'Soft Scan',
  description: 'A quieter scanline pass with cool edge lift and sparse routes.',
  process: processSoftScan,
};
