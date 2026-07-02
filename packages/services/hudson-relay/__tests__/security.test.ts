import { describe, expect, it } from 'vitest';
import {
  isValidMultiplexerName,
  resolveBootstrapPath,
  shellQuote,
  verifyReconnectToken,
  type Session,
} from '../src/relay/session';
import { isAllowedOrigin, tokenMatches } from '../src/relay/access';

describe('multiplexer session name validation', () => {
  it('accepts boring names', () => {
    expect(isValidMultiplexerName('hudson-abc123')).toBe(true);
    expect(isValidMultiplexerName('my_session')).toBe(true);
  });

  it('rejects shell metacharacters and injection payloads', () => {
    expect(isValidMultiplexerName('x; rm -rf ~ #')).toBe(false);
    expect(isValidMultiplexerName('$(whoami)')).toBe(false);
    expect(isValidMultiplexerName('a b')).toBe(false);
    expect(isValidMultiplexerName('a`id`')).toBe(false);
    expect(isValidMultiplexerName('')).toBe(false);
    expect(isValidMultiplexerName('-x'.padEnd(80, 'y'))).toBe(false); // too long
  });
});

describe('shellQuote', () => {
  it('wraps values and neutralizes embedded single quotes', () => {
    expect(shellQuote('claude')).toBe(`'claude'`);
    expect(shellQuote(`x'; rm -rf ~ #`)).toBe(`'x'\\''; rm -rf ~ #'`);
  });
});

describe('resolveBootstrapPath', () => {
  const cwd = '/tmp/hudson-session';

  it('resolves paths inside the cwd', () => {
    expect(resolveBootstrapPath(cwd, 'notes.md')).toBe('/tmp/hudson-session/notes.md');
    expect(resolveBootstrapPath(cwd, 'sub/dir/file.txt')).toBe('/tmp/hudson-session/sub/dir/file.txt');
  });

  it('rejects paths that escape the cwd', () => {
    expect(resolveBootstrapPath(cwd, '../../.ssh/authorized_keys')).toBeNull();
    expect(resolveBootstrapPath(cwd, '/etc/passwd')).toBeNull();
    expect(resolveBootstrapPath(cwd, '..')).toBeNull();
    expect(resolveBootstrapPath(cwd, 'sub/../../escape')).toBeNull();
  });
});

describe('verifyReconnectToken', () => {
  const session = { reconnectToken: 'a'.repeat(32) } as Session;

  it('accepts the matching token', () => {
    expect(verifyReconnectToken(session, 'a'.repeat(32))).toBe(true);
  });

  it('rejects wrong, empty, or non-string tokens', () => {
    expect(verifyReconnectToken(session, 'b'.repeat(32))).toBe(false);
    expect(verifyReconnectToken(session, '')).toBe(false);
    expect(verifyReconnectToken(session, undefined)).toBe(false);
    expect(verifyReconnectToken(session, 'a'.repeat(31))).toBe(false);
  });
});

describe('isAllowedOrigin', () => {
  it('allows loopback origins and absent origins', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3500')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3600')).toBe(true);
    expect(isAllowedOrigin('http://[::1]:3600')).toBe(true);
  });

  it('rejects remote origins', () => {
    expect(isAllowedOrigin('http://evil.com')).toBe(false);
    expect(isAllowedOrigin('https://attacker.example')).toBe(false);
    expect(isAllowedOrigin('not-a-url')).toBe(false);
  });
});

describe('tokenMatches', () => {
  it('allows any token when none is configured', () => {
    delete process.env.HUDSON_RELAY_TOKEN;
    expect(tokenMatches(undefined)).toBe(true);
    expect(tokenMatches('anything')).toBe(true);
  });

  it('requires an exact match when configured', () => {
    process.env.HUDSON_RELAY_TOKEN = 'secret-token';
    try {
      expect(tokenMatches('secret-token')).toBe(true);
      expect(tokenMatches('wrong')).toBe(false);
      expect(tokenMatches(undefined)).toBe(false);
      expect(tokenMatches('')).toBe(false);
    } finally {
      delete process.env.HUDSON_RELAY_TOKEN;
    }
  });
});
