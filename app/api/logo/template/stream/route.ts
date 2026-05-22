import { appStorage, createFsWatchEventStream } from 'hudsonkit/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = appStorage('logo', { migrateFromDataDir: 'logos' });
const TEMPLATE_REL = 'logo-templates';
const templatePaths = storage.paths(TEMPLATE_REL);

async function ensureTemplates() {
  await storage.seedIfEmpty({
    rel: TEMPLATE_REL,
    match: (file) => file.endsWith('.js'),
    copyMissing: true,
  });
}

export async function GET(request: Request) {
  return createFsWatchEventStream({
    request,
    watchPaths: [templatePaths.user],
    ensure: ensureTemplates,
  });
}
