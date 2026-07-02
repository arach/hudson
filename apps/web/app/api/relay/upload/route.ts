import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { rejectUntrustedLocalRequest } from '@/app/lib/localRequestGuard';

const UPLOAD_DIR = '/tmp/hudson-uploads';

export async function POST(req: NextRequest) {
  const rejected = rejectUntrustedLocalRequest(req);
  if (rejected) return rejected;

  try {
    const { name, data } = (await req.json()) as { name: string; data: string };

    if (!name || !data) {
      return NextResponse.json(
        { error: 'Missing name or data' },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Client names go straight into a path — keep only a safe basename so
    // `../` segments can't climb out of the upload dir.
    const safeName = name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 128);
    const filename = `${randomUUID()}-${safeName || 'upload'}`;
    const filepath = join(UPLOAD_DIR, filename);

    await writeFile(filepath, Buffer.from(data, 'base64'));

    return NextResponse.json({ path: filepath });
  } catch (err) {
    console.error('Upload failed:', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
