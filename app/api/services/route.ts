import { NextResponse } from 'next/server';
import { SERVICE_CATALOG } from '../../services/catalog';
import { probeHealth } from '../../services/executor';

export async function GET() {
  const results = await Promise.all(
    SERVICE_CATALOG.map(async (svc) => {
      let status: 'running' | 'not_installed' | 'unknown' = 'unknown';
      if (svc.check.healthUrl) {
        const alive = await probeHealth(svc.check.healthUrl, 1, 0);
        status = alive ? 'running' : 'not_installed';
      }
      return { ...svc, status };
    }),
  );
  return NextResponse.json(results);
}
