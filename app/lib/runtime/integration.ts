import { HUDSON_RUNTIME_CLIENT_ID, RUNTIME_CONTROL_PROFILES } from './paths';
import type { RuntimeIntegrationDescriptor } from './types';

export function createRuntimeIntegrationDescriptor(origin: string): RuntimeIntegrationDescriptor {
  const logo = new URL('/og.png', origin).href;

  return {
    id: HUDSON_RUNTIME_CLIENT_ID,
    name: 'HudsonKit Runtime',
    brand: {
      name: 'HudsonKit',
      product: 'Runtime',
      logo,
      accent: 'cyan',
    },
    description:
      'HudsonKit Runtime bridges the web workspace to the native macOS menubar companion. ' +
      'Runtime nodes, tmux sessions, and spatial layout stay on the companion; Hudson sends JSONL control commands and reads workspace status back.',
    controlProfiles: RUNTIME_CONTROL_PROFILES,
    commands: [
      'status',
      'select',
      'focus',
      'focus-mode',
      'exit-focus',
      'tile',
      'viewport',
      'save-workspace',
      'restore-workspace',
      'setup',
      'metrics',
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function createRuntimeLaunchCommand(origin: string): string {
  const descriptor = createRuntimeIntegrationDescriptor(origin);
  const primary = descriptor.controlProfiles[0];
  return [
    'HUDSON_VANTAGE_CONTROL_FILE=' + primary.commandPath,
    'HUDSON_VANTAGE_RESPONSE_FILE=' + primary.responsePath,
    'HUDSON_VANTAGE_STATE_FILE=' + primary.statePath,
    'apps/vantage/scripts/run-app.sh',
  ].join(' ');
}
