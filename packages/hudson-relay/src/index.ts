#!/usr/bin/env node

/**
 * hudson-relay — Standalone server bundling WebSocket PTY relay + HTTP API.
 *
 * Usage:
 *   node --no-warnings --import tsx packages/hudson-relay/src/index.ts [--port 3600]
 *   bun run relay
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { startServer } from './server';

// Load .env.local from the project root (same vars Next.js sees)
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const portFlag = process.argv.indexOf('--port');
const port = portFlag !== -1 ? Number(process.argv[portFlag + 1]) : Number(process.env.RELAY_PORT) || 3600;

startServer(port);
