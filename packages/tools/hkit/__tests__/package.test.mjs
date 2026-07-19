import { describe, expect, it } from 'vitest';
import { shouldUseDeepSigning } from '../src/commands/package.mjs';

describe('hkit package signing', () => {
  it('uses deep signing only when the app has no independently signed helpers', () => {
    expect(shouldUseDeepSigning({})).toBe(true);
    expect(shouldUseDeepSigning({ embeddedHelpers: [] })).toBe(true);
    expect(shouldUseDeepSigning({ embeddedHelpers: [{ name: 'Hudson Helper' }] })).toBe(false);
  });
});
