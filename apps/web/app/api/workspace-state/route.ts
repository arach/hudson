import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isSafeFileId, rejectUntrustedLocalRequest } from '@/app/lib/localRequestGuard';
import { REPO_ROOT } from '@/app/lib/repoRoot';

const STATE_DIR = join(REPO_ROOT, '.data', 'workspace-state');

async function ensureDir() {
  await mkdir(STATE_DIR, { recursive: true });
}

function filePath(workspaceId: string) {
  return join(STATE_DIR, `${workspaceId}.json`);
}

/**
 * GET /api/workspace-state?id=logo-pipeline
 * Returns the persisted state for a workspace.
 */
export async function GET(req: NextRequest) {
  const rejected = rejectUntrustedLocalRequest(req);
  if (rejected) return rejected;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ?id=' }, { status: 400 });
  if (!isSafeFileId(id)) return NextResponse.json({ error: 'Invalid workspace id' }, { status: 400 });

  await ensureDir();
  try {
    const raw = await readFile(filePath(id), 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

/**
 * POST /api/workspace-state
 * Body: { id: string, state: Record<string, unknown> }
 * Merges state into the persisted workspace file.
 */
export async function POST(req: NextRequest) {
  const rejected = rejectUntrustedLocalRequest(req);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const { id, state } = body as { id: string; state: Record<string, unknown> };
    if (!id || !state) return NextResponse.json({ error: 'Missing id or state' }, { status: 400 });
    if (typeof id !== 'string' || !isSafeFileId(id)) {
      return NextResponse.json({ error: 'Invalid workspace id' }, { status: 400 });
    }

    await ensureDir();
    const path = filePath(id);

    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await readFile(path, 'utf-8'));
    } catch { /* new file */ }

    const merged = { ...existing, ...state, updatedAt: Date.now() };
    await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8');
    return NextResponse.json(merged);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
