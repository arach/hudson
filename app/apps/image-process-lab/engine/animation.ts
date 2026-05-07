import { hash2d } from './dither';
import { clampByte } from './palette';
import type { ImageProcessAnimationSettings } from '../types';

export function motionPhase(animation: ImageProcessAnimationSettings, timeMs: number, seed: number): number {
  if (animation.mode === 'still' || animation.intensity <= 0) return 0;
  const speed = 0.18 + animation.speed / 34;
  const t = timeMs / 1000 * speed + seed * 0.013;
  if (animation.mode === 'drift') return Math.sin(t * 0.55) * 0.55 + Math.cos(t * 0.23) * 0.45;
  if (animation.mode === 'scan') return ((t * 0.18) % 1) * 2 - 1;
  return Math.sin(t);
}

export function applyAnimatedFilter(
  base: ImageData,
  animation: ImageProcessAnimationSettings,
  timeMs: number,
  seed: number,
): ImageData {
  const output = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
  if (animation.filter === 'none' || animation.intensity <= 0) return output;

  const { width, height, data } = output;
  const amount = animation.intensity / 100;
  const phase = motionPhase(animation, timeMs, seed);
  const scanY = ((phase + 1) / 2) * height;
  const phaseSeed = seed + Math.round((phase + 1) * 997);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;

      if (animation.filter === 'ct-scan') {
        const band = Math.max(0, 1 - Math.abs(y - scanY) / Math.max(18, height * 0.12));
        const line = y % 6 === 0 ? 0.82 : 1;
        const lift = band * amount;
        data[i] = clampByte(r * (1 - lift * 0.18) * line);
        data[i + 1] = clampByte(g + lift * 62);
        data[i + 2] = clampByte(b + lift * 34);
      } else if (animation.filter === 'print-lab') {
        const grain = hash2d(Math.floor(x / 2), Math.floor(y / 2), phaseSeed) - 0.5;
        const dot = ((x + y + phaseSeed) % 7) < 2 ? 1 : 0;
        const response = (grain * 34 + dot * 10 * phase) * amount;
        data[i] = clampByte(r + response * 0.45);
        data[i + 1] = clampByte(g + response * 0.72);
        data[i + 2] = clampByte(b + response * 0.38);
      } else {
        const wash = (0.55 + phase * 0.45) * amount;
        const sparkle = hash2d(Math.floor(x / 5), Math.floor(y / 5), phaseSeed) > 0.985 ? amount * 42 : 0;
        data[i] = clampByte(r * (1 - wash * 0.08) + lum * wash * 0.02);
        data[i + 1] = clampByte(g + wash * 34 + sparkle);
        data[i + 2] = clampByte(b + wash * 16);
      }
    }
  }

  return output;
}
