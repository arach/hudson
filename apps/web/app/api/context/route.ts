import { NextResponse } from 'next/server';
import { readFile, readdir, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { isSafeFileId, rejectUntrustedLocalRequest } from '@/app/lib/localRequestGuard';
import { REPO_ROOT } from '@/app/lib/repoRoot';

// ---------------------------------------------------------------------------
// Context store — one .json file per context item
// ---------------------------------------------------------------------------
const CONTEXT_DIR = join(REPO_ROOT, '.data', 'context');

async function ensureDir() {
  await mkdir(CONTEXT_DIR, { recursive: true });
}

interface ContextItem {
  id: string;
  label?: string;
  content: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// GET — list items or fetch a single one
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const rejected = rejectUntrustedLocalRequest(request);
  if (rejected) return rejected;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id !== null) {
    if (!isSafeFileId(id)) {
      return NextResponse.json({ error: 'Invalid context id' }, { status: 400 });
    }
    await ensureDir();
    try {
      const raw = await readFile(join(CONTEXT_DIR, `${id}.json`), 'utf-8');
      return NextResponse.json({ item: JSON.parse(raw) });
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  await ensureDir();
  const files = await readdir(CONTEXT_DIR);
  const items: Omit<ContextItem, 'content'>[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(CONTEXT_DIR, file), 'utf-8');
      const item = JSON.parse(raw) as ContextItem;
      items.push({ id: item.id, label: item.label, createdAt: item.createdAt });
    } catch {
      // Skip corrupt files
    }
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ items });
}

// ---------------------------------------------------------------------------
// POST — create or delete a context item
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const rejected = rejectUntrustedLocalRequest(request);
  if (rejected) return rejected;

  try {
    const body = await request.json();

    // Delete
    if (body.action === 'delete') {
      if (typeof body.id !== 'string' || !isSafeFileId(body.id)) {
        return NextResponse.json({ error: 'Invalid context id' }, { status: 400 });
      }
      await ensureDir();
      try {
        await unlink(join(CONTEXT_DIR, `${body.id}.json`));
      } catch { /* already gone */ }
      return NextResponse.json({ deleted: true, id: body.id });
    }

    // Create
    if (!body.content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const id = crypto.randomUUID().slice(0, 12);
    const item: ContextItem = {
      id,
      label: body.label,
      content: body.content,
      createdAt: Date.now(),
    };

    await ensureDir();
    await writeFile(join(CONTEXT_DIR, `${id}.json`), JSON.stringify(item, null, 2), 'utf-8');
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
