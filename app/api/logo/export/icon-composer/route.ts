import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const NUMERIC_KEYS = new Set([
  'borderRadius', 'paneRadius', 'gapWidth', 'splitX', 'splitY', 'padding',
]);

function coerceParams(params: Record<string, unknown>): Record<string, unknown> {
  const p = { ...params };
  for (const key of NUMERIC_KEYS) {
    if (key in p && typeof p[key] !== 'number') p[key] = Number(p[key]);
  }
  return p;
}

function execPromise(cmd: string, args: string[], timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
    child.unref?.();
  });
}

const ICON_COMPOSER_DIR = join(tmpdir(), 'hudson-icon-composer');

// ---------------------------------------------------------------------------
// GET — check if Icon Composer is installed
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const result = await execPromise('/usr/bin/mdfind', [
      'kMDItemCFBundleIdentifier == "com.apple.dt.icon-composer"',
    ]);
    return NextResponse.json({ available: result.trim().length > 0 });
  } catch {
    return NextResponse.json({ available: false });
  }
}

// ---------------------------------------------------------------------------
// POST — render 1024px PNG and open Icon Composer
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { renderBody, params } = body as {
      renderBody: string;
      params: Record<string, unknown>;
    };

    if (!renderBody || !params) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build SVG and rasterize at 1024px
    const VB = 512;
    const coerced = coerceParams(params);
    // eslint-disable-next-line no-new-func
    const fn = new Function('p', 'vb', renderBody);
    const inner = fn(coerced, VB);
    if (typeof inner !== 'string') throw new Error('renderBody must return a string');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}">${inner}</svg>`;

    const pngBuffer = await sharp(Buffer.from(svg, 'utf-8'))
      .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Write to temp directory
    await fs.mkdir(ICON_COMPOSER_DIR, { recursive: true });
    const filePath = join(ICON_COMPOSER_DIR, 'AppIcon-1024.png');
    await fs.writeFile(filePath, pngBuffer);

    // Try to open Icon Composer
    try {
      await execPromise('/usr/bin/open', ['-a', 'Icon Composer']);
    } catch {
      // Icon Composer not found — just open the file with default app
      await execPromise('/usr/bin/open', [filePath]);
    }

    return NextResponse.json({ opened: true, filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
