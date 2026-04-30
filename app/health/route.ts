import { NextResponse } from 'next/server';
import { createHudsonVoxUnavailableHealth, getHudsonVoxHealth } from '@/app/lib/tts/voxBridge';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getHudsonVoxHealth());
  } catch (error) {
    return NextResponse.json(
      createHudsonVoxUnavailableHealth(error),
      { status: 503 },
    );
  }
}
