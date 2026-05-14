// ---------------------------------------------------------------------------
// Capability helpers and status utilities
// ---------------------------------------------------------------------------

import type { Backend, BackendCapabilities } from './types';

/** Check whether a backend supports streaming (default true per spec). */
export function supportsStreaming(caps: BackendCapabilities): boolean {
  return caps.streaming !== false;
}

/** Check whether a backend manages persistent sessions. */
export function supportsSessions(caps: BackendCapabilities): boolean {
  return caps.sessions === true;
}

/** Check whether a backend requires a relay service. */
export function requiresRelay(caps: BackendCapabilities): boolean {
  return caps.relay === 'required';
}

/** Check whether a backend needs credentials. */
export function requiresAuth(caps: BackendCapabilities): boolean {
  return caps.auth !== undefined && caps.auth !== 'none';
}

/** Probe a backend's status. Returns `{ available: true }` if no status() method. */
export async function checkStatus<Cfg>(
  backend: Backend<Cfg>,
  config: Cfg,
): Promise<{ available: boolean; reason?: string }> {
  if (!backend.status) return { available: true };
  return backend.status(config);
}

/**
 * Derive a UI affordance hint from a backend's capabilities and status.
 * Returns null when the backend is available; otherwise returns the
 * recommended CTA type and reason string.
 */
export function unavailableAffordance(
  caps: BackendCapabilities,
  status: { available: boolean; reason?: string },
): { cta: 'start-relay' | 'configure-api-key' | 'sign-in' | 'unavailable'; reason: string } | null {
  if (status.available) return null;

  const reason = status.reason ?? 'Backend unavailable';

  if (caps.relay === 'required') return { cta: 'start-relay', reason };
  if (caps.auth === 'api-key') return { cta: 'configure-api-key', reason };
  if (caps.auth === 'oauth') return { cta: 'sign-in', reason };

  return { cta: 'unavailable', reason };
}
