import { timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { BlockList, isIP } from 'net';

// ---------------------------------------------------------------------------
// Relay access control — origin allow-list + optional shared-secret token.
//
// The relay hands out interactive shells, so it never trusts the network.
// These helpers read env lazily because index.ts loads .env.local after the
// module graph is imported.
// ---------------------------------------------------------------------------

export const UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV =
  'HUDSON_RELAY_UNSAFE_ALLOW_UNAUTHENTICATED_NON_LOOPBACK';

const loopbackAddresses = new BlockList();
loopbackAddresses.addSubnet('127.0.0.0', 8, 'ipv4');
loopbackAddresses.addAddress('::1', 'ipv6');

export function authToken(): string | null {
  return process.env.HUDSON_RELAY_TOKEN?.trim() || null;
}

function extraAllowedOrigins(): Set<string> {
  return new Set(
    (process.env.HUDSON_RELAY_ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );
}

export function isLoopbackHostname(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (clean === 'localhost') return true;

  const addressFamily = isIP(clean);
  if (addressFamily === 4) return loopbackAddresses.check(clean, 'ipv4');
  if (addressFamily === 6) return loopbackAddresses.check(clean, 'ipv6');
  return false;
}

export function allowsUnsafeUnauthenticatedNonLoopback(): boolean {
  return process.env[UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV] === '1';
}

export function assertSafeRelayBinding(host: string): void {
  if (isLoopbackHostname(host) || authToken() || allowsUnsafeUnauthenticatedNonLoopback()) return;

  throw new Error(
    `[relay] Refusing to bind to non-loopback host "${host}" without authentication. ` +
      `Set HUDSON_RELAY_TOKEN, or set ${UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV}=1 ` +
      'only if you explicitly accept unauthenticated remote access.',
  );
}

/** Browser-sent Origin must be loopback or explicitly allow-listed. Absent
 *  Origin (curl, native apps, server-side clients) is allowed — those callers
 *  are covered by the loopback bind and the optional token. */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (extraAllowedOrigins().has(normalized)) return true;
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function tokenMatches(supplied: string | null | undefined): boolean {
  const configured = authToken();
  if (!configured) return true;
  if (!supplied) return false;
  const expected = Buffer.from(configured, 'utf8');
  const given = Buffer.from(supplied, 'utf8');
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function extractToken(req: IncomingMessage, url: URL): string | null {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const headerToken = req.headers['x-relay-token'];
  if (typeof headerToken === 'string' && headerToken) return headerToken;
  return url.searchParams.get('token');
}
