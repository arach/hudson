import { describe, expect, it, vi } from 'vitest';
import { HObservability } from '../src/observability/core';
import {
  createHudsonFetchCapture,
  formatHudsonNetworkEntryAsCurl,
  formatHudsonNetworkEntryForAgent,
  HudsonNetworkStore,
  installHudsonFetchCapture,
  sanitizeHudsonNetworkEntry,
} from '../src/observability/network';

function createObservability() {
  let id = 0;
  return new HObservability({
    enabled: true,
    createId: () => `net_${++id}`,
  });
}

describe('Hudson network capture', () => {
  it('captures request and response details without delaying or consuming the response', async () => {
    const store = new HudsonNetworkStore();
    const observability = createObservability();
    let tick = 10;
    const originalFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'upstream-1' },
    }));
    const capturedFetch = createHudsonFetchCapture(originalFetch, {
      store,
      observability,
      now: () => tick += 5,
    });

    const response = await capturedFetch('https://example.test/items?limit=2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer visible-locally' },
      body: JSON.stringify({ name: 'Hudson' }),
    });

    expect(await response.json()).toEqual({ ok: true });
    await vi.waitFor(() => {
      expect(store.snapshot()[0]?.response?.body?.text).toBe('{"ok":true}');
      expect(store.snapshot()[0]?.request.body?.text).toBe('{"name":"Hudson"}');
    });

    expect(store.snapshot()[0]).toMatchObject({
      schemaVersion: 1,
      id: 'net_1',
      requestId: 'net_1',
      traceId: 'net_1',
      status: 'ok',
      request: {
        method: 'POST',
        url: 'https://example.test/items?limit=2',
        headers: { authorization: 'Bearer visible-locally' },
      },
      response: {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'upstream-1' },
      },
      timing: { startedAt: 15, completedAt: 20, durationMs: 5 },
    });

    const spans = observability.snapshot().filter((event) => event.kind === 'span');
    expect(spans).toHaveLength(2);
    expect(spans[1]).toMatchObject({
      id: 'net_1',
      traceId: 'net_1',
      status: 'ok',
      data: { requestId: 'net_1', status: 200 },
    });
  });

  it('caps captured bodies and marks truncation', async () => {
    const store = new HudsonNetworkStore();
    const capturedFetch = createHudsonFetchCapture(
      async () => new Response('response-too-large'),
      { store, observability: createObservability(), maxBodyBytes: 8 },
    );

    await capturedFetch('https://example.test/upload', {
      method: 'POST',
      body: 'request-too-large',
    });

    await vi.waitFor(() => {
      expect(store.snapshot()[0]?.response?.body?.truncated).toBe(true);
      expect(store.snapshot()[0]?.request.body?.truncated).toBe(true);
    });
    expect(store.snapshot()[0]?.request.body).toMatchObject({ text: 'request-', capturedSize: 8 });
    expect(store.snapshot()[0]?.response?.body).toMatchObject({ text: 'response', capturedSize: 8 });
  });

  it('keeps local inspection raw but sanitizes explicit agent exports', () => {
    const entry = {
      schemaVersion: 1 as const,
      id: 'request-1',
      requestId: 'request-1',
      traceId: 'trace-1',
      timestamp: 1,
      status: 'ok' as const,
      request: {
        method: 'POST',
        url: 'https://example.test/run?access_token=query-secret&visible=yes',
        headers: {
          authorization: 'Bearer header-secret',
          cookie: 'session=cookie-secret',
          'x-api-key': 'key-secret',
          accept: 'application/json',
        },
        body: {
          text: JSON.stringify({ password: 'body-secret', email: 'developer@example.test' }),
          capturedSize: 66,
          truncated: false,
        },
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'set-cookie': 'session=response-secret', 'content-type': 'application/json' },
        body: {
          text: JSON.stringify({ access_token: 'response-token', result: 'ok' }),
          capturedSize: 47,
          truncated: false,
        },
      },
      timing: { startedAt: 1, completedAt: 3, durationMs: 2 },
    };

    expect(entry.request.headers.authorization).toContain('header-secret');
    const safe = sanitizeHudsonNetworkEntry(entry);
    const bundle = formatHudsonNetworkEntryForAgent(entry);
    const curl = formatHudsonNetworkEntryAsCurl(entry);
    const serialized = JSON.stringify({ safe, bundle, curl });

    expect(serialized).not.toContain('query-secret');
    expect(serialized).not.toContain('header-secret');
    expect(serialized).not.toContain('cookie-secret');
    expect(serialized).not.toContain('key-secret');
    expect(serialized).not.toContain('body-secret');
    expect(serialized).not.toContain('response-token');
    expect(serialized).toContain('developer@example.test');
    expect(serialized).toContain('visible=yes');
  });

  it('records failed fetches and preserves the original rejection', async () => {
    const store = new HudsonNetworkStore();
    const failure = new TypeError('network offline');
    const capturedFetch = createHudsonFetchCapture(
      async () => { throw failure; },
      { store, observability: createObservability() },
    );

    await expect(capturedFetch('https://example.test/fail')).rejects.toBe(failure);
    expect(store.snapshot()[0]).toMatchObject({
      status: 'error',
      error: { name: 'TypeError', message: 'network offline' },
    });
  });

  it('treats resolved opaque responses as indeterminate rather than failed', async () => {
    const store = new HudsonNetworkStore();
    const observability = createObservability();
    const opaqueResponse = {
      ok: false,
      status: 0,
      statusText: '',
      type: 'opaque',
      headers: new Headers(),
      body: null,
      clone() { return this; },
    } as unknown as Response;
    const capturedFetch = createHudsonFetchCapture(
      async () => opaqueResponse,
      { store, observability },
    );

    await expect(capturedFetch('https://example.test/no-cors')).resolves.toBe(opaqueResponse);
    expect(store.snapshot()[0]).toMatchObject({
      status: 'ok',
      response: { status: 0 },
    });
    expect(observability.snapshot().at(-1)).toMatchObject({
      kind: 'span',
      status: 'ok',
      data: { opaque: true },
    });
  });

  it('bounds request history by entry count', async () => {
    const store = new HudsonNetworkStore({ maxEntries: 2 });
    const capturedFetch = createHudsonFetchCapture(
      async () => new Response('ok'),
      { store, observability: createObservability() },
    );

    await capturedFetch('https://example.test/one');
    await capturedFetch('https://example.test/two');
    await capturedFetch('https://example.test/three');

    expect(store.snapshot()).toHaveLength(2);
    expect(store.snapshot().map((entry) => entry.request.url)).toEqual([
      'https://example.test/three',
      'https://example.test/two',
    ]);
  });

  it('restores the browser fetch implementation when capture stops', async () => {
    const previousFetch = window.fetch;
    const originalFetch = vi.fn(async () => new Response('ok'));
    const store = new HudsonNetworkStore();
    window.fetch = originalFetch as typeof window.fetch;

    try {
      const stop = installHudsonFetchCapture({ store, observability: createObservability() });
      expect(window.fetch).not.toBe(originalFetch);

      await window.fetch('https://example.test/captured');
      expect(store.snapshot()).toHaveLength(1);

      stop();
      expect(window.fetch).toBe(originalFetch);
    } finally {
      window.fetch = previousFetch;
    }
  });
});
