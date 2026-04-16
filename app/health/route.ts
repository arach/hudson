import { NextResponse } from 'next/server';
import { getHudsonOraSystemHealth } from '@/app/lib/tts/hudsonOraSystem';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getHudsonOraSystemHealth());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'system',
        voices: [],
        capabilities: {
          streaming: false,
          boundaries: false,
        },
        error: error instanceof Error ? error.message : 'Voice backend unavailable.',
      },
      { status: 503 },
    );
  }
}
