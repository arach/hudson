import type { ImageProcessEffectMask } from '../types';

export function imageDataToPng(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context is unavailable');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function drawImageDataToCanvas(imageData: ImageData, canvas: HTMLCanvasElement): void {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context is unavailable');
  ctx.putImageData(imageData, 0, 0);
}

function effectMaskFactor(mask: ImageProcessEffectMask, x: number, y: number, width: number, height: number): number {
  if (!mask.enabled) return 1;

  const px = width <= 1 ? 50 : (x / (width - 1)) * 100;
  const py = height <= 1 ? 50 : (y / (height - 1)) * 100;
  const halfW = Math.max(1, mask.width) / 2;
  const halfH = Math.max(1, mask.height) / 2;
  const left = mask.x - halfW;
  const right = mask.x + halfW;
  const top = mask.y - halfH;
  const bottom = mask.y + halfH;
  const dx = Math.max(left - px, 0, px - right);
  const dy = Math.max(top - py, 0, py - bottom);
  const outsideDistance = Math.hypot(dx, dy);

  if (outsideDistance <= 0) return 1;
  return Math.max(0, 1 - outsideDistance / Math.max(1, mask.feather));
}

export function applyEffectMask(source: ImageData, effect: ImageData, mask: ImageProcessEffectMask): ImageData {
  if (!mask.enabled || source.width !== effect.width || source.height !== effect.height) return effect;

  const output = new ImageData(new Uint8ClampedArray(effect.data), effect.width, effect.height);
  const { width, height, data } = output;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const factor = effectMaskFactor(mask, x, y, width, height);
      if (factor >= 1) continue;

      const i = (y * width + x) * 4;
      data[i] = source.data[i] * (1 - factor) + effect.data[i] * factor;
      data[i + 1] = source.data[i + 1] * (1 - factor) + effect.data[i + 1] * factor;
      data[i + 2] = source.data[i + 2] * (1 - factor) + effect.data[i + 2] * factor;
      data[i + 3] = source.data[i + 3] * (1 - factor) + effect.data[i + 3] * factor;
    }
  }

  return output;
}
