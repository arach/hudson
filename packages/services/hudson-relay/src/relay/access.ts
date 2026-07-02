import { timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';

// ---------------------------------------------------------------------------
// Relay access control — origin allow-list + optional shared-secret token.
//
// The relay hands out interactive shells, so it never trusts the network.
// These helpers read env lazily because index.ts loads .env.local after the
// module graph is imported.
// ---------------------------------------------------------------------------

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
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
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
