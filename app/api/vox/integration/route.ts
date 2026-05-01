import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  HUDSON_VOX_INTEGRATION_FILE_NAME,
  createHudsonVoxIntegrationDescriptor,
  isHudsonVoxRegistrableOrigin,
  normalizeHudsonVoxOrigin,
} from '@/app/lib/voxIntegration';

export const runtime = 'nodejs';

const registerSchema = z.object({
  origin: z.string().trim().min(1).optional(),
});

function resolveRequestOrigin(request: Request, bodyOrigin?: string): string {
  const headerOrigin = request.headers.get('origin') ?? undefined;
  const fallbackOrigin = new URL(request.url).origin;
  const origin = bodyOrigin ?? headerOrigin ?? fallbackOrigin;
  const normalized = normalizeHudsonVoxOrigin(origin);

  if (bodyOrigin && headerOrigin && normalized !== normalizeHudsonVoxOrigin(headerOrigin)) {
    throw new Error('Origin mismatch.');
  }

  if (!isHudsonVoxRegistrableOrigin(normalized)) {
    throw new Error(`HudsonKit will not register untrusted Vox origin ${normalized}.`);
  }

  return normalized;
}

function descriptorPath() {
  return join(homedir(), '.vox', 'origins.d', HUDSON_VOX_INTEGRATION_FILE_NAME);
}

async function writeDescriptor(origin: string) {
  const descriptor = createHudsonVoxIntegrationDescriptor(origin);
  const filePath = descriptorPath();
  await mkdir(join(homedir(), '.vox', 'origins.d'), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
  return { descriptor, filePath };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid Vox integration registration request.', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const origin = resolveRequestOrigin(request, parsed.data.origin);
    const result = await writeDescriptor(origin);
    return NextResponse.json({
      ok: true,
      path: result.filePath,
      descriptor: result.descriptor,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register HudsonKit with Vox.' },
      { status: 500 },
    );
  }
}
