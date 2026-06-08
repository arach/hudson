import {
  FEATURE_FLAG_LAYER_ORDER,
  type AudienceIncludes,
  type FeatureFlagAudience,
  type FeatureFlagDefinition,
  type FeatureFlagGate,
  type FeatureFlagLayer,
  type FeatureFlagLayerInput,
  type FeatureFlagOverride,
  type FeatureFlagRegistry,
  type FeatureFlagResolution,
  type FeatureFlagResolver,
  type FeatureFlagResolverInput,
} from './types';

export function createFlagResolver<R extends FeatureFlagRegistry, TAudience extends string = string>(
  input: FeatureFlagResolverInput<R, TAudience>,
): FeatureFlagResolver<R, TAudience> {
  const audience = resolveAudience(input);
  const includes = input.audienceIncludes ?? createAudienceIncludes(input.audienceOrder);
  const warned = new Set<string>();

  function warnUnknown(key: string) {
    if (!input.warnOnUnknown || warned.has(key)) return;
    warned.add(key);
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[hudsonkit/flags] Unknown feature flag "${key}" resolved false.`);
    }
  }

  const typedRegistry = input.registry as unknown as Record<string, FeatureFlagDefinition<TAudience>>;

  function explain(key: string): FeatureFlagResolution<TAudience> {
    const definition = typedRegistry[key];
    if (!definition) {
      warnUnknown(key);
      return { key, enabled: false, value: false, layer: 'default', audience, reason: 'unknown-flag' };
    }

    const override = findWinningOverride(input.layers, key);
    if (override) {
      return { key, enabled: override.value, value: override.value, layer: override.layer, audience, requiredTier: definition.tier, reason: 'override', definition };
    }

    if (!definition.defaultEnabled) {
      return { key, enabled: false, value: false, layer: 'default', audience, requiredTier: definition.tier, reason: 'default', definition };
    }

    if (definition.tier && !includes(audience, definition.tier)) {
      return { key, enabled: false, value: false, layer: 'default', audience, requiredTier: definition.tier, reason: 'audience-denied', definition };
    }

    return { key, enabled: true, value: true, layer: 'default', audience, requiredTier: definition.tier, reason: 'default', definition };
  }

  return {
    registry: input.registry,
    isEnabled: key => explain(String(key)).enabled,
    explain: key => explain(String(key)),
    all: () => Object.keys(input.registry).sort().map(explain),
    audience: () => audience,
  };
}

export function isFlagEnabled<R extends FeatureFlagRegistry>(resolver: FeatureFlagResolver<R> | null | undefined, key: string): boolean {
  return resolver ? resolver.isEnabled(key) : true;
}

export function isGateEnabled<R extends FeatureFlagRegistry>(
  gate: FeatureFlagGate<R> | null | undefined,
  resolver: FeatureFlagResolver<R> | null | undefined,
): boolean {
  if (!gate || !resolver) return true;
  const gateObject = typeof gate === 'string' ? { key: gate } : gate;
  if (!resolver.isEnabled(gateObject.key)) return false;
  return gateObject.when ? gateObject.when(resolver) : true;
}

export function filterFlaggedItems<T extends { flag?: FeatureFlagGate }>(items: readonly T[], resolver: FeatureFlagResolver | null | undefined): T[] {
  if (!resolver) return [...items];
  return items.filter(item => isGateEnabled(item.flag, resolver));
}

function resolveAudience<TAudience extends string>(input: FeatureFlagResolverInput<FeatureFlagRegistry, TAudience>): FeatureFlagAudience<TAudience> {
  let tier = input.audience.tier;
  for (const layer of FEATURE_FLAG_LAYER_ORDER.slice().reverse()) {
    const override = input.layers?.[layer]?.audience;
    if (override) tier = override;
  }
  return { ...input.audience, tier };
}

function createAudienceIncludes<TAudience extends string>(order?: readonly TAudience[]): AudienceIncludes<TAudience> {
  return (active, required) => {
    if (active.tier === required) return true;
    if (!order || order.length === 0) return false;
    const activeIdx = order.indexOf(active.tier);
    const requiredIdx = order.indexOf(required);
    if (activeIdx < 0 || requiredIdx < 0) return false;
    return activeIdx >= requiredIdx;
  };
}

function findWinningOverride<TAudience extends string>(
  layers: FeatureFlagResolverInput<FeatureFlagRegistry, TAudience>['layers'],
  key: string,
): { layer: FeatureFlagLayer; value: boolean } | null {
  for (const layer of FEATURE_FLAG_LAYER_ORDER) {
    const value = normalizeOverride(layers?.[layer]?.flags?.[key]);
    if (value !== null) return { layer, value };
  }
  return null;
}

export function normalizeOverride(value: FeatureFlagOverride): boolean | null {
  if (value === true || value === 'on') return true;
  if (value === false || value === 'off') return false;
  return null;
}

export function normalizeFeatureFlagLayer<TAudience extends string = string>(input: unknown): FeatureFlagLayerInput<TAudience> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const flags: Record<string, FeatureFlagOverride> = {};
  const rawFlags = raw.flags && typeof raw.flags === 'object' ? raw.flags as Record<string, unknown> : raw;
  for (const [key, value] of Object.entries(rawFlags)) {
    if (key === 'audience' || key === 'version' || key === 'featureFlags') continue;
    const parsed = parseOverrideValue(value);
    if (parsed !== undefined) flags[key] = parsed;
  }
  const audience = typeof raw.audience === 'string' && raw.audience.trim() ? raw.audience.trim() as TAudience : undefined;
  return { flags, audience };
}

export function parseOverrideValue(value: unknown): FeatureFlagOverride {
  if (value === true || value === false) return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled', 'enable'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no', 'disabled', 'disable'].includes(normalized)) return false;
  if (['default', 'null', 'unset', 'clear'].includes(normalized)) return 'default';
  return undefined;
}
