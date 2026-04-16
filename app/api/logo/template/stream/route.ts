import { existsSync } from 'fs';
import { copyFile } from 'fs/promises';
import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { createFsWatchEventStream } from '../../../../lib/server/createFsWatchEventStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOME = process.env.HOME || '';
const TEMPLATES_DIR = join(HOME, 'hudson', 'logos', '.data', 'logo-templates');
const SEED_DIR = join(process.cwd(), '.data', 'logo-templates');

let seeded = false;

async function ensureDir() {
  await mkdir(TEMPLATES_DIR, { recursive: true });

  if (!seeded) {
    seeded = true;
    if (existsSync(SEED_DIR)) {
      const existing = new Set((await readdir(TEMPLATES_DIR)).filter((file) => file.endsWith('.js')));
      const seeds = (await readdir(SEED_DIR)).filter((file) => file.endsWith('.js'));
      const missing = seeds.filter((file) => !existing.has(file));
      if (missing.length > 0) {
        await Promise.all(
          missing.map((file) => copyFile(join(SEED_DIR, file), join(TEMPLATES_DIR, file))),
        );
      }
    }
  }
}

export async function GET(request: Request) {
  return createFsWatchEventStream({
    request,
    watchPaths: [TEMPLATES_DIR],
    ensure: ensureDir,
  });
}
