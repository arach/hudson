import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';

// ---------------------------------------------------------------------------
// macOS .iconset sizes: [filename, pixel size]
// ---------------------------------------------------------------------------
const MACOS_ICONSET: [string, number][] = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

// ---------------------------------------------------------------------------
// iOS AppIcon sizes: [filename, pixel size, idiom, scale, point size]
// ---------------------------------------------------------------------------
const IOS_ICONS: { filename: string; size: number; idiom: string; scale: string; point: number }[] = [
  { filename: 'icon-1024.png', size: 1024, idiom: 'universal', scale: '1x', point: 1024 },
  { filename: 'icon-180.png', size: 180, idiom: 'iphone', scale: '3x', point: 60 },
  { filename: 'icon-120.png', size: 120, idiom: 'iphone', scale: '2x', point: 60 },
  { filename: 'icon-87.png', size: 87, idiom: 'iphone', scale: '3x', point: 29 },
  { filename: 'icon-80.png', size: 80, idiom: 'iphone', scale: '2x', point: 40 },
  { filename: 'icon-76.png', size: 76, idiom: 'ipad', scale: '1x', point: 76 },
  { filename: 'icon-60.png', size: 60, idiom: 'iphone', scale: '1x', point: 60 },
  { filename: 'icon-58.png', size: 58, idiom: 'iphone', scale: '2x', point: 29 },
  { filename: 'icon-40.png', size: 40, idiom: 'iphone', scale: '1x', point: 40 },
  { filename: 'icon-29.png', size: 29, idiom: 'iphone', scale: '1x', point: 29 },
  { filename: 'icon-20.png', size: 20, idiom: 'iphone', scale: '1x', point: 20 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSvg(renderBody: string, params: Record<string, unknown>): string {
  const VB = 512;
  // eslint-disable-next-line no-new-func
  const fn = new Function('p', 'vb', renderBody);
  const inner = fn(params, VB);
  if (typeof inner !== 'string') throw new Error('renderBody must return a string');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}">${inner}</svg>`;
}

async function rasterize(svgBuffer: Buffer, size: number): Promise<Buffer> {
  return sharp(svgBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function execPromise(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function buildContentsJson(icons: typeof IOS_ICONS) {
  return {
    images: icons.map(i => ({
      filename: i.filename,
      idiom: i.idiom,
      scale: i.scale,
      size: `${i.point}x${i.point}`,
    })),
    info: { version: 1, author: 'hudson' },
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { renderBody, params, platform } = body as {
      renderBody: string;
      params: Record<string, unknown>;
      platform: 'macos' | 'ios';
    };

    if (!renderBody || !params || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const svg = buildSvg(renderBody, params);
    const svgBuffer = Buffer.from(svg, 'utf-8');

    // Pre-rasterize all needed sizes
    const allSizes = platform === 'macos'
      ? [...new Set(MACOS_ICONSET.map(([, s]) => s))]
      : IOS_ICONS.map(i => i.size);
    const uniqueSizes = [...new Set(allSizes)];
    const pngMap = new Map<number, Buffer>();
    await Promise.all(
      uniqueSizes.map(async (size) => {
        pngMap.set(size, await rasterize(svgBuffer, size));
      }),
    );

    // Build zip archive as a stream
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    // Collect chunks from the archive stream
    const collectPromise = new Promise<Buffer>((resolve, reject) => {
      const passthrough = new PassThrough();
      archive.pipe(passthrough);
      passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);
    });

    if (platform === 'macos') {
      // Create temp .iconset directory for iconutil
      const tmpDir = join(tmpdir(), `hudson-iconset-${Date.now()}`);
      const iconsetDir = join(tmpDir, 'AppIcon.iconset');
      await fs.mkdir(iconsetDir, { recursive: true });

      // Write PNGs to .iconset
      for (const [filename, size] of MACOS_ICONSET) {
        await fs.writeFile(join(iconsetDir, filename), pngMap.get(size)!);
      }

      // Run iconutil to create .icns
      const icnsPath = join(tmpDir, 'AppIcon.icns');
      await execPromise('/usr/bin/iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);

      // Add .icns to zip
      const icnsData = await fs.readFile(icnsPath);
      archive.append(icnsData, { name: 'AppIcon.icns' });

      // Also include all PNGs in a subfolder
      for (const [filename, size] of MACOS_ICONSET) {
        archive.append(pngMap.get(size)!, { name: `AppIcon.iconset/${filename}` });
      }

      await archive.finalize();
      const zipBuffer = await collectPromise;

      // Cleanup temp files
      await fs.rm(tmpDir, { recursive: true, force: true });

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="AppIcon-macOS.zip"',
        },
      });
    } else {
      // iOS — AppIcon.appiconset
      const prefix = 'AppIcon.appiconset';

      for (const icon of IOS_ICONS) {
        archive.append(pngMap.get(icon.size)!, { name: `${prefix}/${icon.filename}` });
      }
      archive.append(JSON.stringify(buildContentsJson(IOS_ICONS), null, 2), {
        name: `${prefix}/Contents.json`,
      });

      await archive.finalize();
      const zipBuffer = await collectPromise;

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="AppIcon-iOS.zip"',
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
