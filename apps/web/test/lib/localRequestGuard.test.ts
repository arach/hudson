import { describe, expect, it } from 'vitest';
import {
  isLoopbackHostname,
  isSafeFileId,
  isTrustedLocalRequest,
  rejectUntrustedLocalRequest,
} from '@/app/lib/localRequestGuard';

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe('isLoopbackHostname', () => {
  it('recognizes loopback hosts', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('[::1]')).toBe(true);
  });
  it('rejects non-loopback hosts', () => {
    expect(isLoopbackHostname('example.com')).toBe(false);
    expect(isLoopbackHostname('192.168.1.5')).toBe(false);
  });
});

describe('isTrustedLocalRequest', () => {
  it('trusts same-origin loopback browser requests', () => {
    expect(isTrustedLocalRequest(req('http://localhost:3500/api/x', {
      origin: 'http://localhost:3500',
    }))).toBe(true);
  });

  it('trusts local tooling with no origin/referer', () => {
    expect(isTrustedLocalRequest(req('http://127.0.0.1:3500/api/x'))).toBe(true);
  });

  it('rejects cross-origin requests even to a loopback server', () => {
    expect(isTrustedLocalRequest(req('http://localhost:3500/api/x', {
      origin: 'http://evil.com',
    }))).toBe(false);
  });

  it('rejects cross-site fetch metadata', () => {
    expect(isTrustedLocalRequest(req('http://localhost:3500/api/x', {
      'sec-fetch-site': 'cross-site',
    }))).toBe(false);
  });

  it('rejects requests whose Host is not loopback (DNS rebinding)', () => {
    expect(isTrustedLocalRequest(req('http://attacker.example/api/x'))).toBe(false);
  });
});

describe('rejectUntrustedLocalRequest', () => {
  it('returns null for trusted requests', () => {
    expect(rejectUntrustedLocalRequest(req('http://localhost:3500/api/x'))).toBeNull();
  });
  it('returns a 403 for untrusted requests', () => {
    const res = rejectUntrustedLocalRequest(req('http://evil.example/api/x'));
    expect(res?.status).toBe(403);
  });
});

describe('isSafeFileId', () => {
  it('accepts plausible ids', () => {
    expect(isSafeFileId('trace-123')).toBe(true);
    expect(isSafeFileId('logo_pipeline')).toBe(true);
    expect(isSafeFileId('abc.def')).toBe(true);
  });
  it('rejects traversal and separators', () => {
    expect(isSafeFileId('../etc/passwd')).toBe(false);
    expect(isSafeFileId('a/b')).toBe(false);
    expect(isSafeFileId('.hidden')).toBe(false);
    expect(isSafeFileId('')).toBe(false);
    expect(isSafeFileId('a'.repeat(200))).toBe(false);
  });
});
