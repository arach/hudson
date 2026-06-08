import type { FeatureFlagRegistry } from './types';

export function createFlagRegistry<const R extends FeatureFlagRegistry>(registry: R): R {
  return registry;
}
