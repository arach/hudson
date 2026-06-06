import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { AGENT_LOG_FILE, appendAgentObservation } from '@/app/lib/agent-log';

export const runtime = 'nodejs';

const MAX_TAIL_BYTES = 2 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(2000, Number(searchParams.get('limit') ?? '200')));

    let fileStat;
    try {
      fileStat = await stat(AGENT_LOG_FILE);
    } catch {
      return NextResponse.json({ events: [] });
    }

    const raw = fileStat.size > MAX_TAIL_BYTES
      ? await readFileTail(AGENT_LOG_FILE, MAX_TAIL_BYTES, fileStat.size)
      : await readFile(AGENT_LOG_FILE, 'utf-8');

    const lines = raw.split('\n');
    const events: unknown[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // Skip corrupt lines without failing the read
      }
    }

    return NextResponse.json({ events: events.slice(-limit) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const event = isRecord(payload) && 'event' in payload ? payload.event : payload;

    if (!isAgentActionObservation(event)) {
      return NextResponse.json(
        { error: 'Expected an agent-action log or span observation.' },
        { status: 400 },
      );
    }

    const written = await appendAgentObservation(event);
    if (!written) {
      return NextResponse.json(
        { error: 'Unsupported agent-action observation kind.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function readFileTail(path: string, bytes: number, fileSize: number): Promise<string> {
  const { open } = await import('fs/promises');
  const fh = await open(path, 'r');
  try {
    const start = Math.max(0, fileSize - bytes);
    const buf = Buffer.alloc(fileSize - start);
    await fh.read(buf, 0, buf.length, start);
    const text = buf.toString('utf-8');
    const firstNewline = text.indexOf('\n');
    return firstNewline >= 0 ? text.slice(firstNewline + 1) : text;
  } finally {
    await fh.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAgentActionObservation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind !== 'log' && value.kind !== 'span') return false;
  if (value.category === 'agent-action') return true;

  const data = value.data;
  return (
    isRecord(data) &&
    (
      data.triggeredBy === 'agent' ||
      data.triggeredBy === 'server' ||
      data.source === 'workspace-ai'
    )
  );
}
