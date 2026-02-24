// Deterministic PRNG for consistent server-rendered output
function createRng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/**
 * Generate a workspace visualization — dot field with floating "window" rectangles.
 * Rendered as a <pre> block to create the Ingenii-style dot-matrix aesthetic.
 */
export function generateWorkspaceArt(): string {
  const cols = 58;
  const rows = 30;
  const grid: string[][] = [];
  const rand = createRng(42);

  // Light scatter background
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      const r = rand();
      grid[y][x] = r < 0.1 ? '.' : r < 0.15 ? '+' : r < 0.18 ? ':' : ' ';
    }
  }

  // Floating windows
  const windows = [
    { x: 2, y: 2, w: 22, h: 11 },
    { x: 30, y: 4, w: 18, h: 9 },
    { x: 10, y: 17, w: 26, h: 10 },
  ];

  for (const win of windows) {
    for (let x = win.x; x < win.x + win.w && x < cols; x++) {
      const corner = x === win.x || x === win.x + win.w - 1;
      if (win.y < rows) grid[win.y][x] = corner ? '+' : '-';
      const by = win.y + win.h - 1;
      if (by < rows) grid[by][x] = corner ? '+' : '-';
    }
    for (let y = win.y + 1; y < win.y + win.h - 1 && y < rows; y++) {
      if (win.x < cols) grid[y][win.x] = '|';
      const rx = win.x + win.w - 1;
      if (rx < cols) grid[y][rx] = '|';
    }
    // Dense fill
    for (let y = win.y + 1; y < win.y + win.h - 1 && y < rows; y++) {
      for (let x = win.x + 1; x < win.x + win.w - 1 && x < cols; x++) {
        const r = rand();
        grid[y][x] =
          r < 0.2 ? '$' : r < 0.38 ? '+' : r < 0.52 ? ':' : r < 0.64 ? '.' : ' ';
      }
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

/**
 * Generate a dense character field for section backgrounds.
 */
export function generateDotField(cols: number, rows: number, seed = 99): string {
  const rand = createRng(seed);
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const r = rand();
      line += r < 0.15 ? '$' : r < 0.3 ? '+' : r < 0.45 ? ':' : r < 0.55 ? '.' : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
