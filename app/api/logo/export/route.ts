import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';

// ---------------------------------------------------------------------------
// Numeric param coercion (prevents string concatenation in templates)
// ---------------------------------------------------------------------------
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
// iOS AppIcon sizes
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
// Web favicon sizes
// ---------------------------------------------------------------------------
const FAVICON_ICO_SIZES = [16, 32, 48];
const WEB_ICONS = [
  { filename: 'apple-touch-icon.png', size: 180 },
  { filename: 'android-chrome-192x192.png', size: 192 },
  { filename: 'android-chrome-512x512.png', size: 512 },
];

// ---------------------------------------------------------------------------
// Windows .ico sizes
// ---------------------------------------------------------------------------
const WINDOWS_ICO_SIZES = [16, 24, 32, 48, 256];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSvg(renderBody: string, params: Record<string, unknown>): string {
  const VB = 512;
  const coerced = coerceParams(params);
  // eslint-disable-next-line no-new-func
  const fn = new Function('p', 'vb', renderBody);
  const inner = fn(coerced, VB);
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

// ---------------------------------------------------------------------------
// ICO binary encoder (no external deps)
// Embeds PNG data directly — supported by all modern OS/browsers.
// ---------------------------------------------------------------------------
function buildIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const headerSize = 6;
  const entrySize = 16;
  const tableSize = pngs.length * entrySize;
  let dataOffset = headerSize + tableSize;

  // Header: reserved(2) + type=ICO(2) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  // Directory entries
  const entries = Buffer.alloc(tableSize);
  for (let i = 0; i < pngs.length; i++) {
    const { data, size } = pngs[i];
    const off = i * entrySize;
    entries.writeUInt8(size >= 256 ? 0 : size, off);      // width (0 = 256+)
    entries.writeUInt8(size >= 256 ? 0 : size, off + 1);   // height
    entries.writeUInt8(0, off + 2);                         // color palette
    entries.writeUInt8(0, off + 3);                         // reserved
    entries.writeUInt16LE(1, off + 4);                      // color planes
    entries.writeUInt16LE(32, off + 6);                     // bits per pixel
    entries.writeUInt32LE(data.length, off + 8);            // data size
    entries.writeUInt32LE(dataOffset, off + 12);            // data offset
    dataOffset += data.length;
  }

  return Buffer.concat([header, entries, ...pngs.map(p => p.data)]);
}

// ---------------------------------------------------------------------------
// iOS Contents.json
// ---------------------------------------------------------------------------
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
// Web manifest + HTML snippet
// ---------------------------------------------------------------------------
function buildWebManifest() {
  return JSON.stringify({
    name: '',
    short_name: '',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
  }, null, 2);
}

const HTML_SNIPPET = `<!-- Favicon bundle — drop these files in your public/ root -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
`;

// ---------------------------------------------------------------------------
// Per-platform archive builders
// ---------------------------------------------------------------------------

async function addMacOS(
  archive: archiver.Archiver,
  pngMap: Map<number, Buffer>,
  prefix = '',
): Promise<void> {
  const pfx = prefix ? `${prefix}/` : '';
  const tmpDir = join(tmpdir(), `hudson-iconset-${Date.now()}`);
  const iconsetDir = join(tmpDir, 'AppIcon.iconset');
  await fs.mkdir(iconsetDir, { recursive: true });

  for (const [filename, size] of MACOS_ICONSET) {
    await fs.writeFile(join(iconsetDir, filename), pngMap.get(size)!);
  }

  const icnsPath = join(tmpDir, 'AppIcon.icns');
  await execPromise('/usr/bin/iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);

  archive.append(await fs.readFile(icnsPath), { name: `${pfx}AppIcon.icns` });
  for (const [filename, size] of MACOS_ICONSET) {
    archive.append(pngMap.get(size)!, { name: `${pfx}AppIcon.iconset/${filename}` });
  }

  await fs.rm(tmpDir, { recursive: true, force: true });
}

function addIOS(
  archive: archiver.Archiver,
  pngMap: Map<number, Buffer>,
  prefix = '',
): void {
  const pfx = prefix ? `${prefix}/` : '';
  const assetDir = `${pfx}AppIcon.appiconset`;
  for (const icon of IOS_ICONS) {
    archive.append(pngMap.get(icon.size)!, { name: `${assetDir}/${icon.filename}` });
  }
  archive.append(JSON.stringify(buildContentsJson(IOS_ICONS), null, 2), {
    name: `${assetDir}/Contents.json`,
  });
}

function addWeb(
  archive: archiver.Archiver,
  pngMap: Map<number, Buffer>,
  svgString: string,
  prefix = '',
): void {
  const pfx = prefix ? `${prefix}/` : '';

  // favicon.ico (multi-size)
  const icoPngs = FAVICON_ICO_SIZES.map(size => ({ size, data: pngMap.get(size)! }));
  archive.append(buildIco(icoPngs), { name: `${pfx}favicon.ico` });

  // favicon.svg
  archive.append(svgString, { name: `${pfx}favicon.svg` });

  // Touch + manifest icons
  for (const icon of WEB_ICONS) {
    archive.append(pngMap.get(icon.size)!, { name: `${pfx}${icon.filename}` });
  }

  // Manifest + HTML snippet
  archive.append(buildWebManifest(), { name: `${pfx}site.webmanifest` });
  archive.append(HTML_SNIPPET, { name: `${pfx}html-snippet.html` });
}

function addWindows(
  archive: archiver.Archiver,
  pngMap: Map<number, Buffer>,
  prefix = '',
): void {
  const pfx = prefix ? `${prefix}/` : '';

  const icoPngs = WINDOWS_ICO_SIZES.map(size => ({ size, data: pngMap.get(size)! }));
  archive.append(buildIco(icoPngs), { name: `${pfx}app.ico` });

  for (const size of WINDOWS_ICO_SIZES) {
    archive.append(pngMap.get(size)!, { name: `${pfx}icon-${size}.png` });
  }
}

// ---------------------------------------------------------------------------
// Collect all unique sizes across all platforms
// ---------------------------------------------------------------------------
function allPlatformSizes(): number[] {
  const sizes = new Set<number>();
  for (const [, s] of MACOS_ICONSET) sizes.add(s);
  for (const i of IOS_ICONS) sizes.add(i.size);
  for (const s of FAVICON_ICO_SIZES) sizes.add(s);
  for (const i of WEB_ICONS) sizes.add(i.size);
  for (const s of WINDOWS_ICO_SIZES) sizes.add(s);
  return [...sizes];
}

// ---------------------------------------------------------------------------
// Zip helper — collect archive into a Buffer
// ---------------------------------------------------------------------------
function collectArchive(archive: archiver.Archiver): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    const passthrough = new PassThrough();
    archive.pipe(passthrough);
    passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

type Platform = 'macos' | 'ios' | 'web' | 'windows' | 'all';

const PLATFORM_FILENAMES: Record<Platform, string> = {
  macos: 'AppIcon-macOS.zip',
  ios: 'AppIcon-iOS.zip',
  web: 'favicon-bundle.zip',
  windows: 'AppIcon-Windows.zip',
  all: 'AppIcon-All-Platforms.zip',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { renderBody, params, platform } = body as {
      renderBody: string;
      params: Record<string, unknown>;
      platform: Platform;
    };

    if (!renderBody || !params || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const svg = buildSvg(renderBody, params);
    const svgBuffer = Buffer.from(svg, 'utf-8');

    // Determine which sizes to rasterize
    let neededSizes: number[];
    switch (platform) {
      case 'macos':
        neededSizes = [...new Set(MACOS_ICONSET.map(([, s]) => s))];
        break;
      case 'ios':
        neededSizes = [...new Set(IOS_ICONS.map(i => i.size))];
        break;
      case 'web':
        neededSizes = [...new Set([...FAVICON_ICO_SIZES, ...WEB_ICONS.map(i => i.size)])];
        break;
      case 'windows':
        neededSizes = [...WINDOWS_ICO_SIZES];
        break;
      case 'all':
        neededSizes = allPlatformSizes();
        break;
      default:
        return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
    }

    // Rasterize all needed sizes in parallel
    const pngMap = new Map<number, Buffer>();
    await Promise.all(
      [...new Set(neededSizes)].map(async (size) => {
        pngMap.set(size, await rasterize(svgBuffer, size));
      }),
    );

    // Build archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const collectPromise = collectArchive(archive);

    switch (platform) {
      case 'macos':
        await addMacOS(archive, pngMap);
        break;
      case 'ios':
        addIOS(archive, pngMap);
        break;
      case 'web':
        addWeb(archive, pngMap, svg);
        break;
      case 'windows':
        addWindows(archive, pngMap);
        break;
      case 'all':
        await addMacOS(archive, pngMap, 'macos');
        addIOS(archive, pngMap, 'ios');
        addWeb(archive, pngMap, svg, 'web');
        addWindows(archive, pngMap, 'windows');
        break;
    }

    await archive.finalize();
    const zipBuffer = await collectPromise;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${PLATFORM_FILENAMES[platform]}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
