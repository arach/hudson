import { hash2d } from './dither';
import { clampByte } from './palette';
import type { ImageProcessAnimationSettings } from '../types';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_PRIMARY: RgbColor = { r: 16, g: 185, b: 129 };
const DEFAULT_SECONDARY: RgbColor = { r: 34, g: 211, b: 238 };

function parseHexColor(value: string | undefined, fallback: RgbColor): RgbColor {
  if (!value) return fallback;
  const normalized = value.trim().replace(/^#/, '');
  const hex = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

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
  const primary = parseHexColor(animation.primaryColor, DEFAULT_PRIMARY);
  const secondary = parseHexColor(animation.secondaryColor, DEFAULT_SECONDARY);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;

      if (animation.filter === 'ct-scan') {
        const bandWidth = Math.max(32, height * 0.18);
        const band = Math.max(0, 1 - Math.abs(y - scanY) / bandWidth);
        const scan = band * band * amount;
        const slice = Math.max(0, 1 - Math.abs(((y + phaseSeed) % 44) - 22) / 22) * scan * 0.18;
        const texture = (hash2d(Math.floor(x / 14), Math.floor(y / 3), phaseSeed) - 0.5) * scan * 0.08;
        const lift = Math.max(0, scan + slice + texture);
        data[i] = clampByte(r * (1 - lift * 0.1) + primary.r * lift * 0.16 + secondary.r * slice * 0.12 + lum * lift * 0.015);
        data[i + 1] = clampByte(g * (1 - lift * 0.04) + primary.g * lift * 0.2 + secondary.g * slice * 0.16);
        data[i + 2] = clampByte(b * (1 - lift * 0.04) + primary.b * lift * 0.18 + secondary.b * slice * 0.14);
      } else if (animation.filter === 'print-lab') {
        const grain = hash2d(Math.floor(x / 2), Math.floor(y / 2), phaseSeed) - 0.5;
        const dot = ((x + y + phaseSeed) % 7) < 2 ? 1 : 0;
        const response = (grain * 34 + dot * 10 * phase) * amount;
        const target = response >= 0 ? primary : secondary;
        const tint = Math.min(1, Math.abs(response) / 42);
        data[i] = clampByte(r + response * 0.2 + (target.r - r) * tint * 0.08);
        data[i + 1] = clampByte(g + response * 0.24 + (target.g - g) * tint * 0.12);
        data[i + 2] = clampByte(b + response * 0.16 + (target.b - b) * tint * 0.08);
      } else {
        const wash = (0.55 + phase * 0.45) * amount;
        const sparkle = hash2d(Math.floor(x / 5), Math.floor(y / 5), phaseSeed) > 0.985 ? amount : 0;
        data[i] = clampByte(r * (1 - wash * 0.08) + primary.r * wash * 0.12 + secondary.r * sparkle * 0.24 + lum * wash * 0.02);
        data[i + 1] = clampByte(g * (1 - wash * 0.04) + primary.g * wash * 0.18 + secondary.g * sparkle * 0.28);
        data[i + 2] = clampByte(b * (1 - wash * 0.04) + primary.b * wash * 0.13 + secondary.b * sparkle * 0.22);
      }
    }
  }

  return output;
}
