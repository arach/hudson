import { describe, expect, it } from 'vitest';
import {
  frameworkSigningMetadata,
  shouldUseDeepSigning,
  shouldUseHardenedRuntime,
} from '../src/commands/package.mjs';

describe('hkit package signing', () => {
  it('uses deep signing only when the app has no independently signed helpers', () => {
    expect(shouldUseDeepSigning({})).toBe(true);
    expect(shouldUseDeepSigning({ embeddedHelpers: [] })).toBe(true);
    expect(shouldUseDeepSigning({ embeddedHelpers: [{ name: 'Hudson Helper' }] })).toBe(false);
  });

  it('uses hardened runtime only with a real signing identity', () => {
    expect(shouldUseHardenedRuntime('')).toBe(false);
    expect(shouldUseHardenedRuntime('-')).toBe(false);
    expect(shouldUseHardenedRuntime('Apple Development: Example (TEAMID)')).toBe(true);
  });

  it('does not preserve hardened-runtime flags when re-signing a framework ad-hoc', () => {
    expect(frameworkSigningMetadata('')).toBe('identifier');
    expect(frameworkSigningMetadata('-')).toBe('identifier');
    expect(frameworkSigningMetadata('Apple Development: Example (TEAMID)'))
      .toBe('identifier,entitlements,requirements,flags');
  });
});
