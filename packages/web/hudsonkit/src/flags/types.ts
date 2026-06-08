import type { ReactNode } from 'react';

export type FeatureFlagLayer = 'local' | 'url' | 'sharedConfig' | 'env' | 'default';
export const FEATURE_FLAG_LAYER_ORDER = ['local', 'url', 'sharedConfig', 'env'] as const;
export type FeatureFlagOverride = boolean | 'on' | 'off' | 'default' | null | undefined;
export type FeatureFlagReason = 'override' | 'default' | 'audience-denied' | 'unknown-flag';

export interface FeatureFlagDefinition<TAudience extends string = string> {
  label: string;
  description?: string;
  defaultEnabled: boolean;
  tier?: TAudience;
  owner?: string;
  tags?: string[];
  expiresAt?: string;
}

export type FeatureFlagRegistry<TAudience extends string = string> = Record<string, FeatureFlagDefinition<TAudience>>;
export type FeatureFlagKey<R extends FeatureFlagRegistry = FeatureFlagRegistry> = Extract<keyof R, string>;

export interface FeatureFlagAudience<TAudience extends string = string> {
  tier: TAudience;
  traits?: Record<string, string | number | boolean | null | undefined>;
}

export type AudienceIncludes<TAudience extends string = string> =
  (active: FeatureFlagAudience<TAudience>, required: TAudience) => boolean;

export interface FeatureFlagLayerInput<TAudience extends string = string> {
  flags?: Record<string, FeatureFlagOverride>;
  audience?: TAudience | null;
}

export interface FeatureFlagLayers<TAudience extends string = string> {
  env?: FeatureFlagLayerInput<TAudience>;
  sharedConfig?: FeatureFlagLayerInput<TAudience>;
  url?: FeatureFlagLayerInput<TAudience>;
  local?: FeatureFlagLayerInput<TAudience>;
}

export interface FeatureFlagResolverInput<R extends FeatureFlagRegistry = FeatureFlagRegistry, TAudience extends string = string> {
  registry: R;
  audience: FeatureFlagAudience<TAudience>;
  audienceOrder?: readonly TAudience[];
  audienceIncludes?: AudienceIncludes<TAudience>;
  layers?: FeatureFlagLayers<TAudience>;
  warnOnUnknown?: boolean;
}

export interface FeatureFlagResolution<TAudience extends string = string> {
  key: string;
  enabled: boolean;
  layer: FeatureFlagLayer;
  value: boolean;
  audience: FeatureFlagAudience<TAudience>;
  requiredTier?: TAudience;
  reason: FeatureFlagReason;
  definition?: FeatureFlagDefinition<TAudience>;
}

export interface FeatureFlagResolver<R extends FeatureFlagRegistry = FeatureFlagRegistry, TAudience extends string = string> {
  registry: R;
  isEnabled<K extends FeatureFlagKey<R> | string>(key: K): boolean;
  explain<K extends FeatureFlagKey<R> | string>(key: K): FeatureFlagResolution<TAudience>;
  all(): FeatureFlagResolution<TAudience>[];
  audience(): FeatureFlagAudience<TAudience>;
}

export type FeatureFlagGate<R extends FeatureFlagRegistry = FeatureFlagRegistry> =
  | FeatureFlagKey<R>
  | {
      key: FeatureFlagKey<R> | string;
      when?: (resolver: FeatureFlagResolver<R>) => boolean;
      reason?: string;
    };

export interface FeatureFlagLocalState<TAudience extends string = string> {
  version: 1;
  audience?: TAudience | null;
  flags?: Record<string, boolean | null | undefined>;
}

export interface FeatureFlagsContextValue<R extends FeatureFlagRegistry = FeatureFlagRegistry, TAudience extends string = string>
  extends FeatureFlagResolver<R, TAudience> {
  layers: FeatureFlagLayers<TAudience>;
  storageKey: string;
  setLocalOverride(key: string, value: boolean | null): void;
  setLocalAudienceOverride(tier: TAudience | null): void;
  resetLocalOverrides(): void;
}

export interface FeatureFlagsProviderProps<R extends FeatureFlagRegistry = FeatureFlagRegistry, TAudience extends string = string> {
  registry: R;
  audience: FeatureFlagAudience<TAudience>;
  audienceOrder?: readonly TAudience[];
  audienceIncludes?: AudienceIncludes<TAudience>;
  initialLayers?: FeatureFlagLayers<TAudience>;
  storageKey?: string;
  warnOnUnknown?: boolean;
  children: ReactNode;
}
