import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { error: 'Streaming speech playback is not exposed by Hudson yet. Buffered Vox synthesis is available at /v1/audio/speech.' },
    { status: 501 },
  );
}
