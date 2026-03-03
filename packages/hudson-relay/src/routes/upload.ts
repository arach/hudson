import type { IncomingMessage, ServerResponse } from 'http';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = '/tmp/hudson-uploads';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * POST /api/upload — Save a base64-encoded image to /tmp.
 * Mirrors the logic from the Next.js API route app/api/relay/upload/route.ts.
 */
export async function handleUpload(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(req);
    const { name, data } = JSON.parse(body) as { name: string; data: string };

    if (!name || !data) {
      json(res, 400, { error: 'Missing name or data' });
      return;
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}-${name}`;
    const filepath = join(UPLOAD_DIR, filename);

    await writeFile(filepath, Buffer.from(data, 'base64'));

    json(res, 200, { path: filepath });
  } catch (err) {
    console.error('Upload failed:', err);
    json(res, 500, { error: String(err) });
  }
}
