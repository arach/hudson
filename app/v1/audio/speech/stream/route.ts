import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { error: 'Streaming is not implemented for the Hudson system voice backend yet.' },
    { status: 501 },
  );
}
