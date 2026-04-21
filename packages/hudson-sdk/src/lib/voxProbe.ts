// ---------------------------------------------------------------------------
// Vox availability probe
//
// @voxd/client's `probe()` hits `/health`, which is permissive (no origin
// allowlist) — so it succeeds even for origins that Vox refuses to
// transcribe for. That means Hudson would happily record audio, upload to
// `/transcribe`, and only *then* discover the request was blocked — at
// which point the browser has already converted the 403-without-CORS
// response into an opaque network error, which `@voxd/client` tags as
// `network_error`, which Hudson then surfaces as "Vox not reachable"
// with a useless "Install / Launch" CTA (Vox is already running; the
// real fix is allowlisting the origin).
//
// `/capabilities` is behind the same allowlist as `/transcribe`, so we
// probe through it instead. Four outcomes:
//
//   connected      — capabilities returned, daemon.running = true
//   warming        — capabilities returned a non-403 error or !running
//   blocked-origin — capabilities returned 403 / "Origin not allowed"
//   unreachable    — capabilities threw a network error
// ---------------------------------------------------------------------------

export type VoxAvailability = 'connected' | 'warming' | 'blocked-origin' | 'unreachable';

interface ProbeableClient {
  capabilities(): Promise<unknown>;
}

export async function probeVoxAvailability(client: ProbeableClient): Promise<VoxAvailability> {
  try {
    const caps = (await client.capabilities()) as { daemon?: { running?: boolean } } | null | undefined;
    return caps?.daemon?.running ? 'connected' : 'warming';
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code?: unknown }).code;
      const message = String((err as { message?: unknown }).message ?? '');
      if (code === 'http_error') {
        if (message.includes('403') || message.toLowerCase().includes('origin not allowed')) {
          return 'blocked-origin';
        }
        // Some other HTTP error — bridge responded, daemon just isn't ready.
        return 'warming';
      }
    }
    return 'unreachable';
  }
}
