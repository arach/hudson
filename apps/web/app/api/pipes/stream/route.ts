import { mkdir } from 'fs/promises';
import { join } from 'path';
import { createFsWatchEventStream } from '../../../lib/server/createFsWatchEventStream';
import { REPO_ROOT } from '@/app/lib/repoRoot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PIPES_DIR = join(REPO_ROOT, '.data', 'pipes');

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
