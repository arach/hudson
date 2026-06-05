import type { RuntimeControlPaths } from './types';

export const HUDSON_RUNTIME_CLIENT_ID = 'hudsonkit-runtime';

export const RUNTIME_CONTROL_PROFILES: RuntimeControlPaths[] = [
  {
    id: 'hudson-default',
    label: 'Hudson Runtime',
    commandPath: '/tmp/hudson-vantage-control.jsonl',
    responsePath: '/tmp/hudson-vantage-control.responses.jsonl',
    statePath: '/tmp/hudson-vantage-state.json',
  },
];

export function resolveRuntimeProfile(profileId?: string): RuntimeControlPaths {
  const match = RUNTIME_CONTROL_PROFILES.find(profile => profile.id === profileId);
  return match ?? RUNTIME_CONTROL_PROFILES[0];
}
