import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = '/tmp/hudson-uploads';

export async function POST(req: NextRequest) {
  try {
    const { name, data } = (await req.json()) as { name: string; data: string };

    if (!name || !data) {
      return NextResponse.json(
        { error: 'Missing name or data' },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}-${name}`;
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
