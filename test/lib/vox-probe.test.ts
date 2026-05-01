import { describe, expect, it } from 'vitest';
import { probeVoxAvailability } from '@/packages/hudson-sdk/src/lib/voxProbe';

describe('Vox availability probe', () => {
  it('treats current Vox capabilities with top-level running=true as connected', async () => {
    await expect(probeVoxAvailability({
      capabilities: async () => ({
        running: true,
        features: { local_asr: true, local_tts: true },
        daemon: { ok: true, service: 'vox' },
      }),
    })).resolves.toBe('connected');
  });

  it('treats running=false as warming instead of unreachable', async () => {
    await expect(probeVoxAvailability({
      capabilities: async () => ({
        running: false,
        features: { local_asr: false },
      }),
    })).resolves.toBe('warming');
  });

  it('still supports older daemon.running capabilities payloads', async () => {
    await expect(probeVoxAvailability({
      capabilities: async () => ({
        daemon: { running: true },
      }),
    })).resolves.toBe('connected');
  });

  it('reports blocked origins from bridge 403s', async () => {
    await expect(probeVoxAvailability({
      capabilities: async () => {
        throw { code: 'http_error', message: '403 Forbidden: {"error":"Origin not allowed"}' };
      },
    })).resolves.toBe('blocked-origin');
  });
});
