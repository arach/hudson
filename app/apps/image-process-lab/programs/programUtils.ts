import type { Rgb } from '../engine/palette';

export function luminance(r: number, g: number, b: number): number {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function sourceAt(data: Uint8ClampedArray, width: number, x: number, y: number): Rgb {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

export function edgeAmount(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): number {
  const current = sourceAt(data, width, x, y);
  const right = sourceAt(data, width, Math.min(width - 1, x + 1), y);
  const down = sourceAt(data, width, x, Math.min(height - 1, y + 1));
  const l0 = luminance(current.r, current.g, current.b);
  const lx = luminance(right.r, right.g, right.b);
  const ly = luminance(down.r, down.g, down.b);
  return Math.min(1, (Math.abs(l0 - lx) + Math.abs(l0 - ly)) / 120);
}

export function mosaicSource(input: ImageData, size: number): Uint8ClampedArray {
  if (size <= 1) return new Uint8ClampedArray(input.data);

  const { width, height, data } = input;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let yy = y; yy < Math.min(height, y + size); yy += 1) {
        for (let xx = x; xx < Math.min(width, x + size); xx += 1) {
          const i = (yy * width + xx) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count += 1;
        }
      }

      const avgR = r / count;
      const avgG = g / count;
      const avgB = b / count;
      const avgA = a / count;

      for (let yy = y; yy < Math.min(height, y + size); yy += 1) {
        for (let xx = x; xx < Math.min(width, x + size); xx += 1) {
          const i = (yy * width + xx) * 4;
          output[i] = avgR;
          output[i + 1] = avgG;
          output[i + 2] = avgB;
          output[i + 3] = avgA;
        }
      }
    }
  }

  return output;
}
