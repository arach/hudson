// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createConversationBroker } from '../../app/lib/conversationBroker';
const ORIGIN = 'http://127.0.0.1:3518';
function fixture() {
  const environment = { GPT_LIVE_DELEGATION_MODEL: 'fixture-model', GPT_LIVE_MODEL: 'gpt-live-1' };
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ transport: { sdp: 'answer' }, session: { id: 'test' } })));
  const key = vi.fn((): string | undefined => 'secret-never-return');
  const broker = createConversationBroker({ environment: () => environment, key, fetch: fetcher as unknown as typeof fetch, now: () => 1000, timeoutMs: 10 });
  return { broker, fetcher, key, environment };
}
function request(body: unknown = { sdp: 'offer' }, origin: string | null = ORIGIN, url = `${ORIGIN}/api/conversation/session`) {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin === null ? {} : { origin }) }, body: JSON.stringify(body) });
}
describe('local conversation broker', () => {
  it('publishes readiness without secrets or contacting the provider', async () => {
    const f = fixture(); const result = await f.broker.status(new Request(`${ORIGIN}/api/conversation/status`));
    expect(await result.json()).toMatchObject({ ready: true, config: { model: 'gpt-live-1' }, sessionLimitSeconds: 90 });
    expect(f.fetcher).not.toHaveBeenCalled(); expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects remote hosts and foreign origins before reading credentials', async () => {
    const f = fixture();
    for (const req of [request({}, 'https://evil.example'), request({}, null), request({}, 'https://hudson.example', 'https://hudson.example/api/conversation/session')]) {
      expect((await f.broker.session(req)).status).toBe(403);
    }
    expect((await f.broker.status(new Request('https://hudson.example/api/conversation/status'))).status).toBe(403);
    expect(f.key).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('uses the real Host authority when Next normalizes Request.url', async () => {
    const f = fixture();
    const req = new Request('http://localhost:3518/api/conversation/session', { method: 'POST', headers: { host: '127.0.0.1:3518', origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ sdp: 'offer' }) });
    expect((await f.broker.session(req)).status).toBe(200);
    const foreign = new Request('http://localhost:3518/api/conversation/status', { headers: { host: 'evil.example', origin: 'http://evil.example' } });
    expect((await f.broker.status(foreign)).status).toBe(403);
  });
  it('reports missing credentials or delegation model without activating', async () => {
    const f = fixture(); f.key.mockReturnValue(undefined);
    expect(await (await f.broker.status(new Request(`${ORIGIN}/api/conversation/status`))).json()).toMatchObject({ ready: false });
    expect((await f.broker.session(request())).status).toBe(503);
    f.key.mockReturnValue('secret'); f.environment.GPT_LIVE_DELEGATION_MODEL = '';
    expect((await f.broker.session(request())).status).toBe(503); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('rejects client overrides, missing SDP, and malformed JSON', async () => {
    const f = fixture();
    for (const body of [{ sdp: 'offer', model: 'other' }, { sdp: '' }, [], null, { token: 'x' }]) expect((await f.broker.session(request(body))).status).toBe(400);
    expect((await f.broker.session(new Request(`${ORIGIN}/api/conversation/session`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' }))).status).toBe(400);
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('bounds the streamed byte count even without Content-Length', async () => {
    const f = fixture(); expect((await f.broker.session(request({ sdp: 'é'.repeat(33000) }))).status).toBe(413);
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('negotiates only server-owned configuration and limits connection attempts', async () => {
    const f = fixture();
    const first = await f.broker.session(request()); expect(first.status).toBe(200);
    const text = await first.text(); expect(text).not.toContain('secret'); expect(JSON.parse(text)).toEqual({ sdp: 'answer', sessionId: 'test' });
    const options = f.fetcher.mock.calls[0][1]!;
    expect(JSON.parse(options.body as string)).toMatchObject({ session: { model: 'gpt-live-1' }, transport: { sdp: 'offer' } });
    await f.broker.session(request()); await f.broker.session(request()); expect((await f.broker.session(request())).status).toBe(429);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });
  it('sanitizes provider and credential errors', async () => {
    const f = fixture(); f.fetcher.mockRejectedValueOnce(new Error('secret-never-return'));
    const reply = await f.broker.session(request()); expect(reply.status).toBe(502); expect(await reply.text()).not.toContain('secret-never-return');
    f.key.mockImplementation(() => { throw new Error('private vault detail'); });
    expect(await (await f.broker.status(new Request(`${ORIGIN}/api/conversation/status`))).text()).not.toContain('private vault detail');
  });
  it('aborts provider fetch when the exchange deadline expires', async () => {
    const f = fixture();
    f.fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(new Error('aborted'))); }));
    expect((await f.broker.session(request())).status).toBe(502);
    expect(f.fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
});
