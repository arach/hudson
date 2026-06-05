import type { ServiceDefinition } from 'hudsonkit';

const IS_DEV_ENV = process.env.NODE_ENV === 'development';

const relayService: ServiceDefinition = {
  id: 'relay',
  name: 'Hudson Relay',
  description: 'WebSocket PTY relay + HTTP API for terminal sessions and compilation',
  version: '0.1.0',
  icon: 'Radio',
  check: { healthUrl: 'http://localhost:3600/health', port: 3600 },
  install: { command: 'bun install', cwd: 'packages/services/hudson-relay' },
  start: { command: 'bun run relay' },
};

const preframeService: ServiceDefinition = {
  id: 'preframe',
  name: 'Preframe',
  description: 'Local Preframe render queue and Remotion-backed logo animation service',
  icon: 'Film',
  check: { healthUrl: 'http://localhost:3100/api/health', port: 3100 },
  install: { command: 'bun install', cwd: '../preframe' },
  start: { command: 'bun run dev', cwd: '../preframe', env: { JOBS_PORT: '4100' } },
};

const HUDSON_DEV_PORT = process.env.PORT ?? '3500';

const hudsonNativeService: ServiceDefinition = {
  id: 'hudson-native',
  name: 'Hudson App',
  description: 'Native macOS Hudson host for Runtime, menu services, permissions, and local daemons',
  version: '0.1.0',
  icon: 'LayoutGrid',
  check: { healthUrl: `http://localhost:${HUDSON_DEV_PORT}/api/runtime/status` },
  install: {
    command: 'HUDSONKIT_WITH_TERMINAL=1 swift build --package-path native',
    cwd: 'apps/hudson',
  },
  start: {
    command: 'bash scripts/run-app.sh',
    cwd: 'apps/hudson',
    env: { HUDSONKIT_WITH_TERMINAL: '1' },
  },
};

export const SERVICE_CATALOG: ServiceDefinition[] = [
  relayService,
  ...(IS_DEV_ENV ? [preframeService, hudsonNativeService] : []),
];
