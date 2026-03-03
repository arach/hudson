#!/usr/bin/env node

/**
 * hudson-relay — Standalone server bundling WebSocket PTY relay + HTTP API.
 *
 * Usage:
 *   node --no-warnings --import tsx packages/hudson-relay/src/index.ts [--port 3600]
 *   bun run relay
 */

import { startServer } from './server';

const portFlag = process.argv.indexOf('--port');
const port = portFlag !== -1 ? Number(process.argv[portFlag + 1]) : Number(process.env.RELAY_PORT) || 3600;

startServer(port);
