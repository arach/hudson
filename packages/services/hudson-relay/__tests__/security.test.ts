// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import {
  isValidMultiplexerName,
  resolveBootstrapPath,
  shellQuote,
  verifyReconnectToken,
  type Session,
} from '../src/relay/session';
import {
  UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV,
  assertSafeRelayBinding,
  isAllowedOrigin,
  isLoopbackHostname,
  tokenMatches,
} from '../src/relay/access';
import { startServer } from '../src/server';

afterEach(() => {
  delete process.env.HUDSON_RELAY_TOKEN;
  delete process.env[UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV];
});

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

describe('isLoopbackHostname', () => {
  it('recognizes localhost and IPv4 and IPv6 loopback addresses', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('LOCALHOST')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('127.42.10.8')).toBe(true);
    expect(isLoopbackHostname('::1')).toBe(true);
    expect(isLoopbackHostname('[::1]')).toBe(true);
    expect(isLoopbackHostname('0:0:0:0:0:0:0:1')).toBe(true);
    expect(isLoopbackHostname('::ffff:127.0.0.1')).toBe(true);
  });

  it('rejects wildcard, private-network, public, and named non-loopback hosts', () => {
    expect(isLoopbackHostname('0.0.0.0')).toBe(false);
    expect(isLoopbackHostname('::')).toBe(false);
    expect(isLoopbackHostname('2001:db8::1')).toBe(false);
    expect(isLoopbackHostname('192.168.1.10')).toBe(false);
    expect(isLoopbackHostname('relay.internal')).toBe(false);
    expect(isLoopbackHostname('example.com')).toBe(false);
  });
});

describe('relay binding policy', () => {
  it('preserves unauthenticated loopback development', () => {
    expect(() => assertSafeRelayBinding('127.0.0.1')).not.toThrow();
    expect(() => assertSafeRelayBinding('127.0.0.2')).not.toThrow();
    expect(() => assertSafeRelayBinding('::1')).not.toThrow();
    expect(() => assertSafeRelayBinding('localhost')).not.toThrow();
  });

  it.each(['0.0.0.0', '::', '2001:db8::1', '192.168.1.10', 'relay.internal'])(
    'refuses unauthenticated non-loopback host %s',
    (host) => {
      expect(() => assertSafeRelayBinding(host)).toThrow(/Refusing to bind.*without authentication/);
    },
  );

  it('refuses an unsafe bind before startServer creates a listener', () => {
    expect(() => startServer(0, '0.0.0.0')).toThrow(/Refusing to bind.*without authentication/);
  });

  it('allows non-loopback binding when a token is configured', () => {
    process.env.HUDSON_RELAY_TOKEN = 'secret-token';

    expect(() => assertSafeRelayBinding('0.0.0.0')).not.toThrow();
    expect(() => assertSafeRelayBinding('::')).not.toThrow();
    expect(() => assertSafeRelayBinding('2001:db8::1')).not.toThrow();
    expect(() => assertSafeRelayBinding('192.168.1.10')).not.toThrow();
  });

  it('requires the deliberately unsafe override to be exactly 1', () => {
    process.env[UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV] = 'true';
    expect(() => assertSafeRelayBinding('0.0.0.0')).toThrow();

    process.env[UNSAFE_UNAUTHENTICATED_NON_LOOPBACK_ENV] = '1';
    expect(() => assertSafeRelayBinding('0.0.0.0')).not.toThrow();
  });
});

describe('tokenMatches', () => {
  it('allows any token when none is configured', () => {
    expect(tokenMatches(undefined)).toBe(true);
    expect(tokenMatches('anything')).toBe(true);
  });

  it('requires an exact match when configured', () => {
    process.env.HUDSON_RELAY_TOKEN = 'secret-token';
    expect(tokenMatches('secret-token')).toBe(true);
    expect(tokenMatches('wrong')).toBe(false);
    expect(tokenMatches(undefined)).toBe(false);
    expect(tokenMatches('')).toBe(false);
  });

  it('requires raw clients without an Origin to present a configured token', () => {
    process.env.HUDSON_RELAY_TOKEN = 'secret-token';

    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(tokenMatches(undefined)).toBe(false);
    expect(tokenMatches('secret-token')).toBe(true);
  });
});
