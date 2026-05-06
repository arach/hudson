const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
];

export function bayer8(x: number, y: number): number {
  return (BAYER_8[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
}

export function hash2d(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ Math.imul(y, 374761393), 668265263);
  h = Math.imul(h ^ Math.imul(seed, 2246822519), 3266489917);
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}
