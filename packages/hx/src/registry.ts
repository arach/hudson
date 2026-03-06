// ---------------------------------------------------------------------------
// In-memory service registry with disk persistence
// ---------------------------------------------------------------------------

import { readFile, writeFile } from 'fs/promises';
import { REGISTRY_PATH, ensureDir } from './lib/config';
import type { HxService } from './types';

const services = new Map<string, HxService>();

export function getAll(): HxService[] {
  return Array.from(services.values());
}

export function get(id: string): HxService | undefined {
  return services.get(id);
}

export function register(service: HxService): HxService {
  const now = Date.now();
  const existing = services.get(service.id);
  const entry: HxService = {
    ...service,
    registeredAt: existing?.registeredAt ?? now,
    lastSeenAt: now,
  };
  services.set(service.id, entry);
  persist();
  return entry;
}

export function deregister(id: string): boolean {
  const deleted = services.delete(id);
  if (deleted) persist();
  return deleted;
}

export function heartbeat(id: string): boolean {
  const svc = services.get(id);
  if (!svc) return false;
  svc.lastSeenAt = Date.now();
  persist();
  return true;
}

// --- Disk persistence ---

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    await ensureDir();
    const data = JSON.stringify(getAll(), null, 2);
    await writeFile(REGISTRY_PATH, data + '\n', 'utf-8');
  }, 200);
}

export async function load() {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf-8');
    const items: HxService[] = JSON.parse(raw);
    for (const svc of items) {
      services.set(svc.id, svc);
    }
  } catch {
    // No registry file yet — start fresh
  }
}
