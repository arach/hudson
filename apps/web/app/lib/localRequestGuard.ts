import { NextResponse } from 'next/server';

/**
 * Shared guard for privileged local API routes (file writes, process control,
 * secret vault access, SSRF-capable proxies). Lifted from the Theme Designer
 * writeback route, which established the pattern:
 *
 *  - the request must target a loopback hostname (blocks LAN callers and
 *    DNS-rebinding, where the Host header is attacker-controlled)
 *  - browser requests must be same-origin loopback (blocks malicious webpages
 *    driving these routes cross-origin)
 *  - requests without Origin/Referer (curl, scripts, tests) stay usable,
 *    but only against a loopback server
 */

export function isLoopbackHostname(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
}

export function isTrustedLocalRequest(req: Request): boolean {
  const requestUrl = new URL(req.url);
  if (!isLoopbackHostname(requestUrl.hostname)) return false;

  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false;

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.origin === requestUrl.origin && isLoopbackHostname(originUrl.hostname);
    } catch {
      return false;
    }
  }

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.origin === requestUrl.origin && isLoopbackHostname(refererUrl.hostname);
    } catch {
      return false;
    }
  }

  // Non-browser local tooling (curl, tests) generally sends neither Origin nor
  // Referer; keep it usable, but only on a loopback dev server.
  return true;
}

/** 403 response for requests that fail the guard, or null when trusted. */
export function rejectUntrustedLocalRequest(req: Request): NextResponse | null {
  if (isTrustedLocalRequest(req)) return null;
  return NextResponse.json(
    { error: 'This endpoint only accepts same-origin requests on a loopback dev server.' },
    { status: 403 },
  );
}

/**
 * Ids that get spliced into filesystem paths (`.data/traces/<id>.json`, …).
 * The charset excludes path separators and a leading dot, so traversal
 * (`../`, absolute paths, dotfiles) is impossible by construction.
 */
export function isSafeFileId(id: string): boolean {
  return /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/.test(id);
}
