import { NextResponse } from 'next/server';
import { listHudsonOraVoiceCatalog } from '@/app/lib/tts/hudsonOraRegistry';
import type { HudsonOraProvider } from '@/app/lib/tts/ora-compat';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerParam = searchParams.get('provider');
    const modelParam = searchParams.get('model');

    const provider = (
      providerParam === 'system'
      || providerParam === 'openai'
      || providerParam === 'elevenlabs'
      || providerParam === 'groq'
    )
      ? providerParam as HudsonOraProvider
      : undefined;

    return NextResponse.json(
      await listHudsonOraVoiceCatalog({
        provider,
        model: modelParam ?? undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list voices.' },
      { status: 500 },
    );
  }
}
