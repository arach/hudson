import { NextResponse } from 'next/server';
import { findOnlineRuntimeProfile, probeRuntimeCompanion } from '@/app/lib/runtime/controlPlane';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  try {
    const status = profileId
      ? await probeRuntimeCompanion(profileId)
      : await findOnlineRuntimeProfile();

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to probe Runtime companion.',
      },
      { status: 500 },
    );
  }
}
