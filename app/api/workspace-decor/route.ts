import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import type { DecorationItem, DecorState } from 'hudsonkit/workspace';

const RUNTIME_CACHE_DIR = join(process.cwd(), '.data', 'workspace-decor');
const VALID_WORKSPACE_ID = /^[a-z0-9-]+$/i;

function cacheFile(dir: string, workspaceId: string) {
  return join(dir, `${workspaceId}.json`);
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf-8')) as unknown;
}

function isDecorItem(value: unknown): value is DecorationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DecorationItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.type === 'string' &&
    ['text', 'image', 'web', 'step-card'].includes(item.type) &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.y) &&
    Number.isFinite(item.w) &&
    Number.isFinite(item.h)
  );
}

function normalizeState(input: unknown): DecorState | null {
  if (!input || typeof input !== 'object') return null;
  const state = input as Partial<DecorState>;
  if (!Array.isArray(state.items)) return null;

  return {
    items: state.items.filter(isDecorItem),
    visible: typeof state.visible === 'boolean' ? state.visible : true,
    updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : Date.now(),
  };
}

function validateWorkspaceId(id: string | null) {
  return id && VALID_WORKSPACE_ID.test(id) ? id : null;
}

async function readFirstExisting(workspaceId: string) {
  const runtimePath = cacheFile(RUNTIME_CACHE_DIR, workspaceId);
  try {
    const state = normalizeState(await readJson(runtimePath));
    if (state) return state;
  } catch {
    // No runtime cache yet.
  }
  return {};
}

/**
 * GET /api/workspace-decor?id=hudson-os
 * Returns the newest saved decoration snapshot available to the running app.
 */
export async function GET(req: NextRequest) {
  const workspaceId = validateWorkspaceId(req.nextUrl.searchParams.get('id'));
  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing or invalid ?id=' }, { status: 400 });
  }

  return NextResponse.json(await readFirstExisting(workspaceId));
}

/**
 * POST /api/workspace-decor
 * Body: { id: string, state: DecorState }
 *
 * Writes an ignored runtime cache. Do not write under app/ here: Next watches
 * source files in dev, so an in-app save would trigger rebuilds.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = validateWorkspaceId(body?.id);
    const state = normalizeState(body?.state);
    if (!workspaceId || !state) {
      return NextResponse.json({ error: 'Missing or invalid id/state' }, { status: 400 });
    }

    const snapshot = { ...state, updatedAt: Date.now() };

    await mkdir(RUNTIME_CACHE_DIR, { recursive: true });
    await writeFile(
      cacheFile(RUNTIME_CACHE_DIR, workspaceId),
      JSON.stringify(snapshot, null, 2),
      'utf-8',
    );

    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
