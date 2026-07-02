import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  deleteHudsonLocalEnvironmentValue,
  getHudsonLocalEnvironmentStore,
  isValidHudsonEnvKey,
  setHudsonLocalEnvironmentValue,
} from '@/app/lib/localEnvironment';
import { rejectUntrustedLocalRequest } from '@/app/lib/localRequestGuard';

export const runtime = 'nodejs';

const envKeySchema = z.string().trim().min(1).refine(
  value => isValidHudsonEnvKey(value),
  'Environment variable names must match [A-Za-z_][A-Za-z0-9_]*.',
);

const setEnvironmentSchema = z.object({
  key: envKeySchema,
  value: z.string(),
});

const deleteEnvironmentSchema = z.object({
  key: envKeySchema,
});

export async function GET(request: Request) {
  // The store holds local secrets — reads are as sensitive as writes here.
  const rejected = rejectUntrustedLocalRequest(request);
  if (rejected) return rejected;

  try {
    return NextResponse.json(await getHudsonLocalEnvironmentStore());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load local environment.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedLocalRequest(request);
  if (rejected) return rejected;

  try {
    const body = await request.json();
    const parsed = setEnvironmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid environment update.', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await setHudsonLocalEnvironmentValue(parsed.data.key, parsed.data.value),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update local environment.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const rejected = rejectUntrustedLocalRequest(request);
  if (rejected) return rejected;

  try {
    const body = await request.json();
    const parsed = deleteEnvironmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid environment delete request.', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await deleteHudsonLocalEnvironmentValue(parsed.data.key),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete local environment variable.' },
      { status: 500 },
    );
  }
}
