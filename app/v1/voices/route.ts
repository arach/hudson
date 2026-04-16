import { NextResponse } from 'next/server';
import { listHudsonOraSystemVoices } from '@/app/lib/tts/hudsonOraSystem';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({
      voices: await listHudsonOraSystemVoices(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list voices.' },
      { status: 500 },
    );
  }
}
