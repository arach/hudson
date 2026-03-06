import { NextResponse } from 'next/server';

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '0.1.0',
    uptime: Date.now() - startedAt,
    timestamp: Date.now(),
  });
}
