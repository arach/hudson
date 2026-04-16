import { NextResponse } from 'next/server';
import { getHudsonOraHealth } from '@/app/lib/tts/hudsonOraRegistry';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getHudsonOraHealth());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'system',
        providers: [],
        defaultProvider: 'system',
        models: [],
        voices: [],
        capabilities: {
          streaming: false,
          boundaries: false,
          providerSwitching: true,
        },
        error: error instanceof Error ? error.message : 'Voice backend unavailable.',
      },
      { status: 503 },
    );
  }
}
