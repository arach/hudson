import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendRuntimeCommand } from '@/app/lib/runtime/controlPlane';

export const runtime = 'nodejs';

const controlSchema = z.object({
  action: z.string().trim().min(1),
  profileId: z.string().trim().min(1).optional(),
  waitMs: z.number().int().min(250).max(15_000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = controlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid Runtime control request.', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await sendRuntimeCommand(parsed.data);

    if (!result.response) {
      return NextResponse.json(
        {
          ok: false,
          timedOut: result.timedOut,
          paths: result.paths,
          error: 'Companion did not respond before the wait window expired.',
        },
        { status: 504 },
      );
    }

    return NextResponse.json({
      ok: result.response.ok,
      timedOut: false,
      paths: result.paths,
      response: result.response,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Runtime control command failed.' },
      { status: 500 },
    );
  }
}
