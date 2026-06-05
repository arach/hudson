import type { VantageControlPaths } from './types';

export const HUDSON_VANTAGE_CLIENT_ID = 'hudsonkit-vantage';

export const VANTAGE_CONTROL_PROFILES: VantageControlPaths[] = [
  {
    id: 'hudson-default',
    label: 'Hudson Native Console',
    commandPath: '/tmp/hudson-vantage-control.jsonl',
    responsePath: '/tmp/hudson-vantage-control.responses.jsonl',
    statePath: '/tmp/hudson-vantage-state.json',
  },
];

export function resolveVantageProfile(profileId?: string): VantageControlPaths {
  const match = VANTAGE_CONTROL_PROFILES.find(profile => profile.id === profileId);
  return match ?? VANTAGE_CONTROL_PROFILES[0];
}
