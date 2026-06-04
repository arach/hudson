import { NextResponse } from 'next/server';
import { readFile, readdir, writeFile, unlink, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import type { AgentTrace, TraceSummary } from 'hudson-showroom/trace-viewer/types';

// ---------------------------------------------------------------------------
// Trace directory — one .json file per agent run
// ---------------------------------------------------------------------------
const TRACES_DIR = join(process.cwd(), '.data', 'traces');

async function ensureDir() {
  await mkdir(TRACES_DIR, { recursive: true });
}

function toSummary(trace: AgentTrace): TraceSummary {
  return {
    id: trace.id,
    name: trace.name,
    agent: trace.agent,
    model: trace.model,
    status: trace.status,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    totalDurationMs: trace.totalDurationMs,
    stepCount: trace.steps?.length ?? 0,
    error: trace.error,
  };
}

async function readTrace(filePath: string): Promise<AgentTrace | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as AgentTrace;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — list summaries or fetch a single full trace
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  await ensureDir();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Single trace by ID
  if (id) {
    const filePath = join(TRACES_DIR, `${id}.json`);
    const trace = await readTrace(filePath);
    if (!trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }
    return NextResponse.json({ trace });
  }

  // All summaries
  const files = await readdir(TRACES_DIR);
  const summaries: TraceSummary[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const trace = await readTrace(join(TRACES_DIR, file));
    if (trace) summaries.push(toSummary(trace));
  }
  // Newest first
  summaries.sort((a, b) => b.startedAt - a.startedAt);
  return NextResponse.json({ traces: summaries });
}

// ---------------------------------------------------------------------------
// POST — create, update, or delete a trace
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    await ensureDir();
    const body = await request.json();
    const { action, trace } = body as {
      action?: 'delete';
      trace?: AgentTrace & { id?: string };
    };

    // Delete
    if (action === 'delete' && body.id) {
      try {
        await unlink(join(TRACES_DIR, `${body.id}.json`));
      } catch { /* already gone */ }
      return NextResponse.json({ deleted: true, id: body.id });
    }

    // Create or update
    if (!trace) {
      return NextResponse.json({ error: 'trace object required' }, { status: 400 });
    }
    const traceId = trace.id || crypto.randomUUID().slice(0, 12);
    const full: AgentTrace = { ...trace, id: traceId };
    const filePath = join(TRACES_DIR, `${traceId}.json`);
    await writeFile(filePath, JSON.stringify(full, null, 2), 'utf-8');
    const fstat = await stat(filePath);
    return NextResponse.json({ trace: full, mtime: fstat.mtimeMs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
