// ---------------------------------------------------------------------------
// Config — reads/writes ~/.hx/config.json
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { HxConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';

export const HX_DIR = join(homedir(), '.hx');
export const CONFIG_PATH = join(HX_DIR, 'config.json');
export const REGISTRY_PATH = join(HX_DIR, 'registry.json');
export const PID_PATH = join(HX_DIR, 'hx.pid');

export async function ensureDir() {
  await mkdir(HX_DIR, { recursive: true });
}

export async function readConfig(): Promise<HxConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(config: HxConfig): Promise<void> {
  await ensureDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function updateConfig(partial: Partial<HxConfig>): Promise<HxConfig> {
  const current = await readConfig();
  const updated = { ...current, ...partial };
  await writeConfig(updated);
  return updated;
}
