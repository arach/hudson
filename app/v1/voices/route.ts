import { NextResponse } from 'next/server';
import {
  createHudsonVoxUnavailableHealth,
  listHudsonVoxVoiceCatalog,
} from '@/app/lib/tts/voxBridge';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelParam = searchParams.get('model');

    return NextResponse.json(
      await listHudsonVoxVoiceCatalog({
        model: modelParam ?? undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        ...createHudsonVoxUnavailableHealth(error),
        error: error instanceof Error ? error.message : 'Failed to list Vox voices.',
      },
      { status: 503 },
    );
  }
}
