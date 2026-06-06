import { NextResponse } from 'next/server';
import { createRuntimeIntegrationDescriptor } from '@/app/lib/runtime/integration';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(createRuntimeIntegrationDescriptor(origin));
}
