// ---------------------------------------------------------------------------
// Vox availability probe
//
// @voxd/client's `probe()` collapses two distinct failure modes into `false`:
// (a) the companion HTTP bridge is unreachable (daemon not running, wrong
// port, firewall); and (b) the bridge answered but `/health` reported
// `{ ok: false }` — typically during a cold-start window before the daemon
// finishes warming up.
//
// Treating (b) as "not reachable" misleads users into reinstalling or
// relaunching Vox when it is in fact already running. This helper calls
// `capabilities()` as a tiebreaker when `probe()` returns false and the
// daemon reports itself as running, surface `warming` instead of
// `unreachable`.
// ---------------------------------------------------------------------------

export type VoxAvailability = 'connected' | 'warming' | 'unreachable';

interface ProbeableClient {
  probe(): Promise<boolean>;
  capabilities(): Promise<unknown>;
}

export async function probeVoxAvailability(client: ProbeableClient): Promise<VoxAvailability> {
  const alive = await client.probe().catch(() => false);
  if (alive) return 'connected';

  try {
    const caps = (await client.capabilities()) as { daemon?: { running?: boolean } } | null | undefined;
    return caps?.daemon?.running ? 'warming' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
