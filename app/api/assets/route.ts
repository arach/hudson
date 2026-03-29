import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

const ASSETS_DIR = join(process.cwd(), '.data', 'assets');
const MANIFEST = join(ASSETS_DIR, 'manifest.json');

function ensureDir() {
  if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });
}

// ── Manifest helpers ──────────────────────────────────────────────────────

interface AssetEntry {
  id: string;
  name: string;
  file: string;
  contentType: string;
  size: number;
  source: 'drop' | 'paste' | 'url';
  sourceUrl?: string;
  addedAt: number;
  width?: number;
  height?: number;
}

function readManifest(): AssetEntry[] {
  ensureDir();
  if (!existsSync(MANIFEST)) return [];
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  } catch {
    return [];
  }
}

function writeManifest(entries: AssetEntry[]) {
  ensureDir();
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2));
}

// ── Extension from content type ───────────────────────────────────────────

function extFromType(ct: string): string {
  if (ct.includes('svg')) return '.svg';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('webp')) return '.webp';
  return '.png';
}

// ── GET — list assets or serve a file ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const fileParam = req.nextUrl.searchParams.get('file');

  if (fileParam) {
    // Serve a specific asset file
    const filePath = join(ASSETS_DIR, fileParam);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data = readFileSync(filePath);
    const ext = fileParam.split('.').pop() ?? 'png';
    const ct = ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return new NextResponse(data, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // List all assets
  const manifest = readManifest();
  return NextResponse.json({ assets: manifest });
}

// ── POST — save a new asset ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  ensureDir();

  const body = await req.json();
  const { id, name, dataUrl, contentType, size, source, sourceUrl, addedAt, width, height } = body;

  if (!id || !dataUrl) {
    return NextResponse.json({ error: 'Missing id or dataUrl' }, { status: 400 });
  }

  // Decode data URL → binary
  const ct = contentType ?? (dataUrl.match(/^data:([^;,]+)/)?.[1] ?? 'image/png');
  const ext = extFromType(ct);

  // Build a clean filename: use the provided name or fall back to id
  const baseName = (name ?? id).replace(/\.[^.]+$/, ''); // strip existing extension
  const safeName = baseName.replace(/[^a-zA-Z0-9_\-. ]/g, '_').slice(0, 80);
  const fileName = `${safeName}${ext}`;

  // Ensure uniqueness
  let finalName = fileName;
  if (existsSync(join(ASSETS_DIR, finalName))) {
    finalName = `${safeName}-${id.slice(0, 4)}${ext}`;
  }

  // Write binary file
  const base64 = dataUrl.split(',')[1];
  if (base64) {
    writeFileSync(join(ASSETS_DIR, finalName), Buffer.from(base64, 'base64'));
  }

  const entry: AssetEntry = {
    id,
    name: name ?? finalName,
    file: finalName,
    contentType: ct,
    size: size ?? (base64 ? Math.floor(base64.length * 0.75) : 0),
    source: source ?? 'drop',
    sourceUrl,
    addedAt: addedAt ?? Date.now(),
    width,
    height,
  };

  const manifest = readManifest();
  // Replace if same id exists, otherwise prepend
  const filtered = manifest.filter(e => e.id !== id);
  writeManifest([entry, ...filtered]);

  return NextResponse.json({ ok: true, asset: entry });
}

// ── DELETE — remove an asset ──────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing ?id= parameter' }, { status: 400 });
  }

  const manifest = readManifest();
  const entry = manifest.find(e => e.id === id);
  if (entry) {
    // Remove file
    const filePath = join(ASSETS_DIR, entry.file);
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch {}
    }
    // Update manifest
    writeManifest(manifest.filter(e => e.id !== id));
  }

  return NextResponse.json({ ok: true });
}
