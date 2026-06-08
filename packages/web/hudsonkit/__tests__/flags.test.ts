import { describe, expect, test, vi } from 'vitest';
import {
  createFlagRegistry,
  createFlagResolver,
  isGateEnabled,
  normalizeFeatureFlagLayer,
  parseFeatureFlagEnv,
  parseFeatureFlagUrl,
} from '../src/flags/index';

const registry = createFlagRegistry({
  'surface.search': { label: 'Search', defaultEnabled: false, tier: 'everyone' },
  'ops.mesh': { label: 'Mesh', defaultEnabled: true, tier: 'power' },
  'core.chat': { label: 'Chat', defaultEnabled: true, tier: 'everyone' },
} as const);

const audienceOrder = ['everyone', 'internal', 'power'] as const;

describe('feature flag resolver', () => {
  test('uses registry default and audience eligibility when no override wins', () => {
    const everyone = createFlagResolver({
      registry,
      audience: { tier: 'everyone' },
      audienceOrder,
    });

    expect(everyone.explain('core.chat')).toMatchObject({ enabled: true, layer: 'default', reason: 'default' });
    expect(everyone.explain('surface.search')).toMatchObject({ enabled: false, layer: 'default', reason: 'default' });
    expect(everyone.explain('ops.mesh')).toMatchObject({ enabled: false, layer: 'default', reason: 'audience-denied' });

    const power = createFlagResolver({
      registry,
      audience: { tier: 'power' },
      audienceOrder,
    });
    expect(power.explain('ops.mesh')).toMatchObject({ enabled: true, layer: 'default', reason: 'default' });
  });

  test('resolves precedence as local -> url -> sharedConfig -> env -> default', () => {
    const resolver = createFlagResolver({
      registry,
      audience: { tier: 'everyone' },
      audienceOrder,
      layers: {
        env: { flags: { 'ops.mesh': false, 'surface.search': true } },
        sharedConfig: { flags: { 'ops.mesh': true, 'surface.search': false } },
        url: { flags: { 'ops.mesh': false } },
        local: { flags: { 'ops.mesh': true } },
      },
    });

    expect(resolver.explain('ops.mesh')).toMatchObject({ enabled: true, layer: 'local', reason: 'override' });
    expect(resolver.explain('surface.search')).toMatchObject({ enabled: false, layer: 'sharedConfig', reason: 'override' });
  });

  test('explicit overrides bypass audience eligibility', () => {
    const resolver = createFlagResolver({
      registry,
      audience: { tier: 'everyone' },
      audienceOrder,
      layers: { sharedConfig: { flags: { 'ops.mesh': true } } },
    });

    expect(resolver.explain('ops.mesh')).toMatchObject({ enabled: true, layer: 'sharedConfig', reason: 'override' });
  });

  test('audience overrides affect only the no-flag-override default path', () => {
    const resolver = createFlagResolver({
      registry,
      audience: { tier: 'everyone' },
      audienceOrder,
      layers: { sharedConfig: { audience: 'power' } },
    });

    expect(resolver.audience().tier).toBe('power');
    expect(resolver.explain('ops.mesh')).toMatchObject({ enabled: true, layer: 'default', reason: 'default' });
  });

  test('unknown flags resolve false and warn in dev mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolver = createFlagResolver({ registry, audience: { tier: 'power' }, audienceOrder, warnOnUnknown: true });

    expect(resolver.explain('missing.flag')).toMatchObject({ enabled: false, reason: 'unknown-flag' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(resolver.isEnabled('missing.flag')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('gate helpers pass through without resolver and evaluate key/predicate with resolver', () => {
    const resolver = createFlagResolver({ registry, audience: { tier: 'everyone' }, audienceOrder });

    expect(isGateEnabled('ops.mesh', null)).toBe(true);
    expect(isGateEnabled('ops.mesh', resolver)).toBe(false);
    expect(isGateEnabled({ key: 'core.chat', when: r => r.audience().tier === 'everyone' }, resolver)).toBe(true);
  });

  test('parses url, env, and shared config layer shapes', () => {
    expect(parseFeatureFlagUrl('https://x.test/?ff.ops.mesh=1&ff.surface.search=off&ffAudience=power')).toEqual({
      flags: { 'ops.mesh': true, 'surface.search': false },
      audience: 'power',
    });
    expect(parseFeatureFlagEnv({ HUDSON_FLAG_ops_mesh: 'on', HUDSON_FLAGS: 'surface.search:off', HUDSON_FLAG_AUDIENCE: 'internal' })).toEqual({
      flags: { 'ops.mesh': true, 'surface.search': false },
      audience: 'internal',
    });
    expect(normalizeFeatureFlagLayer({ audience: 'power', flags: { 'ops.mesh': 'default', 'core.chat': true } })).toEqual({
      flags: { 'ops.mesh': 'default', 'core.chat': true },
      audience: 'power',
    });
  });
});
