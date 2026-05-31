import { NextResponse } from 'next/server';
import { findOnlineVantageProfile, probeVantageCompanion } from '@/app/lib/vantage/controlPlane';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  try {
    const status = profileId
      ? await probeVantageCompanion(profileId)
      : await findOnlineVantageProfile();

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to probe Vantage companion.',
      },
      { status: 500 },
    );
  }
}
