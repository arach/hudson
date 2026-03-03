import { NextResponse } from 'next/server';
import { executeServiceAction } from '../../../services/executor';

export async function POST(req: Request) {
  const body = await req.json();
  const { serviceId, action, triggeredBy = 'user' } = body as {
    serviceId: string;
    action: 'check' | 'install' | 'start' | 'stop';
    triggeredBy?: 'user' | 'agent' | 'system';
  };

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
