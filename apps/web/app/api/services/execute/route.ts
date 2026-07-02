import { NextResponse } from 'next/server';
import { executeServiceAction } from '../../../services/executor';
import { rejectUntrustedLocalRequest } from '@/app/lib/localRequestGuard';

const ALLOWED_ACTIONS = ['check', 'install', 'start', 'stop'] as const;

export async function POST(req: Request) {
  // Spawns processes on the host — same-origin loopback callers only.
  const rejected = rejectUntrustedLocalRequest(req);
  if (rejected) return rejected;

  const body = await req.json();
  const { serviceId, action, triggeredBy = 'user' } = body as {
    serviceId: string;
    action: 'check' | 'install' | 'start' | 'stop';
    triggeredBy?: 'user' | 'agent' | 'system';
  };

  if (typeof serviceId !== 'string' || !serviceId) {
    return NextResponse.json({ error: 'serviceId required' }, { status: 400 });
  }
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const result = await executeServiceAction({ serviceId, action, triggeredBy });

  if (result.error && result.durationMs === 0) {
    // Unknown service — return 404
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  if (!result.success && result.status === 'error' && result.error === `Unknown action: ${action}`) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (!result.success && result.error) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
