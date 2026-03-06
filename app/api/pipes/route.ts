import { NextResponse } from 'next/server';
import { readFile, writeFile, readdir, unlink, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import type { PipeDefinition } from '@hudson/sdk';

const PIPES_DIR = join(process.cwd(), '.data', 'pipes');

async function ensureDir() {
  await mkdir(PIPES_DIR, { recursive: true });
}

async function readAllPipes(): Promise<PipeDefinition[]> {
  await ensureDir();
  const files = await readdir(PIPES_DIR);
  const pipes: PipeDefinition[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(PIPES_DIR, file), 'utf-8');
      pipes.push(JSON.parse(raw));
    } catch { /* skip malformed */ }
  }
  return pipes;
}

// ---------------------------------------------------------------------------
// GET — return all pipes
// ---------------------------------------------------------------------------
export async function GET() {
  const pipes = await readAllPipes();
  return NextResponse.json({ pipes });
}

// ---------------------------------------------------------------------------
// POST — create, update, or delete a pipe
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, pipe } = body as {
      action?: 'delete' | 'update-pushed';
      pipe?: PipeDefinition;
    };

    await ensureDir();

    // Delete
    if (action === 'delete' && pipe?.id) {
      try {
        await unlink(join(PIPES_DIR, `${pipe.id}.json`));
      } catch { /* already gone */ }
      return NextResponse.json({ deleted: true, id: pipe.id });
    }

    // Update lastPushedAt only
    if (action === 'update-pushed' && pipe?.id) {
      const filePath = join(PIPES_DIR, `${pipe.id}.json`);
      try {
        const raw = await readFile(filePath, 'utf-8');
        const existing = JSON.parse(raw) as PipeDefinition;
        existing.lastPushedAt = Date.now();
        await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
        return NextResponse.json({ pipe: existing });
      } catch {
        return NextResponse.json({ error: 'Pipe not found' }, { status: 404 });
      }
    }

    // Create or full update
    if (!pipe) {
      return NextResponse.json({ error: 'pipe object is required' }, { status: 400 });
    }
    const pipeId = pipe.id || crypto.randomUUID().slice(0, 8);
    const definition: PipeDefinition = {
      ...pipe,
      id: pipeId,
      createdAt: pipe.createdAt || Date.now(),
      lastPushedAt: pipe.lastPushedAt ?? null,
      enabled: pipe.enabled ?? true,
    };
    await writeFile(
      join(PIPES_DIR, `${pipeId}.json`),
      JSON.stringify(definition, null, 2),
      'utf-8',
    );
    return NextResponse.json({ pipe: definition });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
