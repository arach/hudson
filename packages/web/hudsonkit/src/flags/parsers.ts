import { normalizeFeatureFlagLayer, parseOverrideValue } from './resolver';
import type { FeatureFlagLayerInput, FeatureFlagOverride } from './types';

export interface FeatureFlagUrlParseOptions {
  paramPrefix?: string;
  audienceParam?: string;
}

export function parseFeatureFlagUrl<TAudience extends string = string>(input: string | URL, options: FeatureFlagUrlParseOptions = {}): FeatureFlagLayerInput<TAudience> {
  const prefix = options.paramPrefix ?? 'ff.';
  const audienceParam = options.audienceParam ?? 'ffAudience';
  const url = typeof input === 'string' ? new URL(input, 'http://hudson.local') : input;
  const flags: Record<string, FeatureFlagOverride> = {};
  let audience: TAudience | undefined;

  for (const [key, value] of url.searchParams.entries()) {
    if (key === audienceParam && value.trim()) audience = value.trim() as TAudience;
    if (!key.startsWith(prefix)) continue;
    const flagKey = key.slice(prefix.length);
    const parsed = parseOverrideValue(value);
    if (flagKey && parsed !== undefined) flags[flagKey] = parsed;
  }

  return { flags, audience };
}

export interface FeatureFlagEnvParseOptions {
  singlePrefix?: string;
  listKey?: string;
  audienceKey?: string;
}

export function parseFeatureFlagEnv<TAudience extends string = string>(env: Record<string, string | undefined>, options: FeatureFlagEnvParseOptions = {}): FeatureFlagLayerInput<TAudience> {
  const singlePrefix = options.singlePrefix ?? 'HUDSON_FLAG_';
  const listKey = options.listKey ?? 'HUDSON_FLAGS';
  const audienceKey = options.audienceKey ?? 'HUDSON_FLAG_AUDIENCE';
  const flags: Record<string, FeatureFlagOverride> = {};

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(singlePrefix)) continue;
    const flagKey = key.slice(singlePrefix.length).toLowerCase().replace(/__/g, ':').replace(/_/g, '.');
    const parsed = parseOverrideValue(value);
    if (flagKey && parsed !== undefined) flags[flagKey] = parsed;
  }

  const list = env[listKey];
  if (list) {
    for (const part of list.split(',')) {
      const [rawKey, rawValue = 'on'] = part.split(':');
      const flagKey = rawKey?.trim();
      const parsed = parseOverrideValue(rawValue);
      if (flagKey && parsed !== undefined) flags[flagKey] = parsed;
    }
  }

  const audience = env[audienceKey]?.trim() as TAudience | undefined;
  return { flags, audience: audience || undefined };
}

export { normalizeFeatureFlagLayer };
