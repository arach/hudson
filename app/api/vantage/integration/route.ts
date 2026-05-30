import { NextResponse } from 'next/server';
import { createVantageIntegrationDescriptor } from '@/app/lib/vantage/integration';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(createVantageIntegrationDescriptor(origin));
}
