export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const SIGNAL_MOSAIC_PALETTE: Rgb[] = [
  { r: 7, g: 16, b: 13 },
  { r: 13, g: 44, b: 34 },
  { r: 21, g: 102, b: 78 },
  { r: 40, g: 199, b: 147 },
  { r: 205, g: 222, b: 213 },
  { r: 247, g: 250, b: 247 },
];

export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function nearestSignalColor(luminance: number): Rgb {
  if (luminance < 42) return SIGNAL_MOSAIC_PALETTE[0];
  if (luminance < 88) return SIGNAL_MOSAIC_PALETTE[1];
  if (luminance < 138) return SIGNAL_MOSAIC_PALETTE[2];
  if (luminance < 184) return SIGNAL_MOSAIC_PALETTE[3];
  if (luminance < 226) return SIGNAL_MOSAIC_PALETTE[4];
  return SIGNAL_MOSAIC_PALETTE[5];
}
