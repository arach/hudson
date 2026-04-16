import { mkdir } from 'fs/promises';
import { join } from 'path';
import { createFsWatchEventStream } from '../../../lib/server/createFsWatchEventStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PIPES_DIR = join(process.cwd(), '.data', 'pipes');

async function ensureDir() {
  await mkdir(PIPES_DIR, { recursive: true });
}

export async function GET(request: Request) {
  return createFsWatchEventStream({
    request,
    watchPaths: [PIPES_DIR],
    ensure: ensureDir,
  });
}
