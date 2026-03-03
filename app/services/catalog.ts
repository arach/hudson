import type { ServiceDefinition } from '@hudson/sdk';

export const SERVICE_CATALOG: ServiceDefinition[] = [
  {
    id: 'relay',
    name: 'Hudson Relay',
    description: 'WebSocket PTY relay + HTTP API for terminal sessions and compilation',
    version: '0.1.0',
    icon: 'Radio',
    check: { healthUrl: 'http://localhost:3600/health', port: 3600 },
    install: { command: 'bun install', cwd: 'packages/hudson-relay' },
    start: { command: 'bun run relay' },
  },
];
