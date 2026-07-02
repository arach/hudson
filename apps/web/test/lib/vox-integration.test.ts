import { describe, expect, it } from 'vitest';
import {
  createHudsonVoxLaunchUrl,
  createHudsonVoxIntegrationDescriptor,
  getHudsonVoxOriginCandidates,
  isHudsonVoxRegistrableOrigin,
  normalizeHudsonVoxOrigin,
} from '@/app/lib/voxIntegration';

describe('Hudson Vox integration descriptor', () => {
  it('normalizes origins without paths', () => {
    expect(normalizeHudsonVoxOrigin('http://localhost:3500/app/hudson?x=1')).toBe('http://localhost:3500');
  });

  it('adds common loopback aliases for the active dev port', () => {
    expect(getHudsonVoxOriginCandidates('http://localhost:3500')).toEqual([
      'http://127.0.0.1:3500',
      'http://localhost:3500',
    ]);
  });

  it('only registers loopback and HudsonKit origins', () => {
    expect(isHudsonVoxRegistrableOrigin('http://localhost:3500')).toBe(true);
    expect(isHudsonVoxRegistrableOrigin('https://hudsonkit.com')).toBe(true);
    expect(isHudsonVoxRegistrableOrigin('https://preview.hudsonkit.com')).toBe(true);
    expect(isHudsonVoxRegistrableOrigin('https://example.com')).toBe(false);
  });

  it('builds a descriptor Vox can read as an origins.d file', () => {
    const descriptor = createHudsonVoxIntegrationDescriptor('http://localhost:3500');
    expect(descriptor).toMatchObject({
      id: 'hudsonkit',
      name: 'HudsonKit',
      origins: ['http://127.0.0.1:3500', 'http://localhost:3500'],
    });
    expect(descriptor.brand.logo).toBe('http://localhost:3500/og.png');
    expect(descriptor.routes).toContain('/capabilities');
    expect(descriptor.routes).toContain('/transcribe');
    expect(descriptor.permissions).toContain('local_asr');
  });

  it('builds a branded launch URL for Vox registration-aware builds', () => {
    const url = new URL(createHudsonVoxLaunchUrl('https://hudsonkit.com'));
    expect(url.protocol).toBe('vox:');
    expect(url.hostname).toBe('launch');
    expect(url.searchParams.get('clientId')).toBe('hudsonkit');
    expect(url.searchParams.get('name')).toBe('HudsonKit');
    expect(url.searchParams.get('origin')).toBe('https://hudsonkit.com');
    expect(url.searchParams.get('logo')).toBe('https://hudsonkit.com/og.png');
    expect(url.searchParams.get('routes')).toContain('/capabilities');
  });
});
