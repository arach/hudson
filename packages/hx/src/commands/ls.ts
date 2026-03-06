// ---------------------------------------------------------------------------
// hx ls — List registered services
// ---------------------------------------------------------------------------

import { daemonFetch } from '../lib/http';
import { error, bold, cyan, dim, gray, green, yellow } from '../lib/log';
import type { HxService } from '../types';

function ago(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export async function ls() {
  try {
    const res = await daemonFetch('/services');
    if (!res.ok) {
      error(`Daemon returned ${res.status}`);
      process.exit(1);
    }
    const data = await res.json() as { services: HxService[] };
    const services = data.services;

    if (services.length === 0) {
      console.log(`  ${dim('No services registered.')}`);
      return;
    }

    console.log();
    for (const svc of services) {
      const typeColor = svc.type === 'agent' ? green : svc.type === 'app' ? cyan : yellow;
      const typeLabel = typeColor(svc.type.padEnd(6));
      const portLabel = dim(`:${svc.port}`);
      const lastSeen = gray(ago(svc.lastSeenAt));

      console.log(`  ${bold(svc.id.padEnd(20))} ${typeLabel} ${dim(svc.host ?? 'localhost')}${portLabel}  ${lastSeen}`);
      if (svc.endpoints?.length) {
        console.log(`  ${' '.repeat(20)} ${dim(svc.endpoints.join('  '))}`);
      }
    }
    console.log();
  } catch (err) {
    error(`Could not reach daemon. Is it running? (${err instanceof Error ? err.message : err})`);
    process.exit(1);
  }
}
