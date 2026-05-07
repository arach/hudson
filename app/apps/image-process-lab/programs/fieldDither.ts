import { bayer8, hash2d } from '../engine/dither';
import { clampByte, mixRgb, nearestSignalColor, type Rgb } from '../engine/palette';
import type { SignalMosaicParams } from '../types';
import { edgeAmount, luminance, mosaicSource } from './programUtils';
import type { ImageProcessProgram } from './types';

function processFieldDither(input: ImageData, params: SignalMosaicParams): ImageData {
  const { width, height } = input;
  const block = Math.max(2, Math.round(params.mosaicSize * 0.72));
  const source = mosaicSource(input, block);
  const output = new ImageData(width, height);
  const strength = params.strength / 100;
  const paletteMix = params.paletteMix / 100;
  const edgeBoost = params.edgeBoost / 100;
  const traceDensity = params.traceDensity / 100;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const base: Rgb = { r: source[i], g: source[i + 1], b: source[i + 2] };
      const edge = edgeAmount(input.data, width, height, x, y);
      const threshold = (bayer8(x, y) - 0.5) * 72;
      const grain = (hash2d(x, y, params.seed + 101) - 0.5) * 20;
      const lum = luminance(base.r, base.g, base.b);
      const ink = nearestSignalColor(lum + threshold + grain + edge * 54);
      const mixed = mixRgb(base, ink, Math.min(0.9, strength * 0.45 + paletteMix * 0.42 + edge * edgeBoost * 0.38));

      const fieldLine = params.routeOverlay && (y + params.seed) % Math.max(5, block * 2) === 0 ? 1 : 0;
      const packet = hash2d(Math.floor(x / block), Math.floor(y / block), params.seed + 211);
      const spark = packet < traceDensity * 0.11 ? 1 : 0;
      const signal = Math.max(fieldLine * 0.5, spark) * (params.traceGlow / 100);

      output.data[i] = clampByte(mixed.r + signal * 8);
      output.data[i + 1] = clampByte(mixed.g + signal * 58);
      output.data[i + 2] = clampByte(mixed.b + signal * 28);
      output.data[i + 3] = input.data[i + 3];
    }
  }

  return output;
}

export const fieldDitherProgram: ImageProcessProgram = {
  id: 'field-dither',
  name: 'Field Dither',
  description: 'A stronger ordered dither pass with small emerald field traces.',
  process: processFieldDither,
};
