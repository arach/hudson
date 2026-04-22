import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bezier, smooth } = body;

    const publicDir = join(process.cwd(), 'public', 'shaper');

    if (bezier) {
      await writeFile(
        join(publicDir, 'session-bezier.json'),
        JSON.stringify(bezier, null, 2),
        'utf-8'
      );
    }

    if (smooth) {
      await writeFile(
        join(publicDir, 'session-smooth.json'),
        JSON.stringify(smooth, null, 2),
        'utf-8'
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Save failed:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
