import { mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { createFsWatchEventStream } from '../../../lib/server/createFsWatchEventStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTROL_PLANE_DIR = join(homedir(), '.openscout', 'control-plane');
const RELAY_DIR = join(homedir(), '.openscout', 'relay');

async function ensureDir() {
  await Promise.all([
    mkdir(CONTROL_PLANE_DIR, { recursive: true }),
    mkdir(RELAY_DIR, { recursive: true }),
  ]);
}

export async function GET(request: Request) {
  return createFsWatchEventStream({
    request,
    watchPaths: [CONTROL_PLANE_DIR, RELAY_DIR],
    ensure: ensureDir,
  });
}
