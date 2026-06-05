import { HUDSON_VANTAGE_CLIENT_ID, VANTAGE_CONTROL_PROFILES } from './paths';
import type { VantageIntegrationDescriptor } from './types';

export function createVantageIntegrationDescriptor(origin: string): VantageIntegrationDescriptor {
  const logo = new URL('/og.png', origin).href;

  return {
    id: HUDSON_VANTAGE_CLIENT_ID,
    name: 'HudsonKit Native Console',
    brand: {
      name: 'HudsonKit',
      product: 'Native Console',
      logo,
      accent: 'cyan',
    },
    description:
      'HudsonKit Native Console bridges the web workspace to the native macOS Hudson app. ' +
      'Runtime nodes, tmux sessions, spatial layout, permissions, and local services stay in the native host; Hudson Web sends JSONL control commands and reads workspace status back.',
    controlProfiles: VANTAGE_CONTROL_PROFILES,
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

export function createVantageLaunchCommand(origin: string): string {
  const descriptor = createVantageIntegrationDescriptor(origin);
  const primary = descriptor.controlProfiles[0];
  return [
    'HUDSON_VANTAGE_CONTROL_FILE=' + primary.commandPath,
    'HUDSON_VANTAGE_RESPONSE_FILE=' + primary.responsePath,
    'HUDSON_VANTAGE_STATE_FILE=' + primary.statePath,
    'apps/hudson/scripts/run-app.sh',
  ].join(' ');
}
