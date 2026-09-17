import { describe, expect, it } from 'vitest';
import {
  buildGPTLiveDelegation,
  connectGPTLive,
  connectGPTLiveWebRTC,
  type RTCPeerConnectionLike,
} from '../../conversation/openai-live';
import { ConversationError, type ConversationConfig } from '../../conversation/types';
import { FakeSocket, eventReader, flush } from './support';

const config = (overrides: Partial<ConversationConfig> = {}): ConversationConfig => ({
  provider: 'openai-gpt-live',
  model: 'gpt-live-1',
  instructions: 'Be brief.',
  voice: 'alloy',
  inputSampleRate: 24_000,
  options: { delegationModel: 'gpt-5.2' },
  ...overrides,
});

async function connect(options: {
  socket?: FakeSocket;
  configOverrides?: Partial<ConversationConfig>;
  tools?: Parameters<typeof connectGPTLive>[0]['tools'];
} = {}) {
  const socket = options.socket ?? new FakeSocket();
  const opening = connectGPTLive({
    config: config(options.configOverrides),
    tools: options.tools,
    transport: { kind: 'relay', url: 'wss://relay.example/conversation' },
    socketFactory: () => socket,
    closeTimeoutMs: 40,
  });
  await flush();
  socket.push({ type: 'session.started', session: { id: 'live_1' } });
  const session = await opening;
  return { socket, session };
}

function pushCall(socket: FakeSocket, delegation: string, callId: string) {
  socket.push({
    type: 'response.event',
    delegation_id: delegation,
    event: {
      type: 'response.output_item.done',
      item: { type: 'function_call', call_id: callId, name: 'weather', arguments: '{}' },
    },
  });
}

describe('GPT-Live web client', () => {
  it('starts with model, single audio format, output voice, and merged delegation tools', async () => {
    const { socket, session } = await connect({ tools: [{ name: 'weather' }] });
    const start = socket.sent[0];
    expect(start.type).toBe('session.start');
    const body = start.session as Record<string, unknown>;
    expect(body.model).toBe('gpt-live-1');
    const audio = body.audio as Record<string, unknown>;
    expect(audio.format).toEqual({ type: 'audio/pcm', rate: 24_000 });
    expect(audio.output).toEqual({ voice: 'alloy' });
    const delegation = body.delegation as Record<string, unknown>;
    const responses = delegation.responses as Record<string, unknown>;
    expect(responses.model).toBe('gpt-5.2');
    expect((responses.tools as Array<Record<string, unknown>>)[0].name).toBe('weather');
    const reader = eventReader(session);
    expect(await reader.next()).toEqual({ type: 'ready', sessionId: 'live_1' });
  });

  it('validates delegation before any socket exists', () => {
    expect(() => buildGPTLiveDelegation(config({ options: {} }), [{ name: 'weather' }]))
      .toThrowError(/backend model/);
    expect(() => buildGPTLiveDelegation(config({ options: { delegation: 'nope' } }), []))
      .toThrowError(/JSON object/);
    expect(() => buildGPTLiveDelegation(
      config({ options: { delegation: '{"type":"responses","responses":{}}' } }), [],
    )).toThrowError(/backend model/);
    expect(() => buildGPTLiveDelegation(
      config({ options: {
        delegation: '{"type":"responses","responses":{"model":"gpt-5.2","tools":[{"type":"web_search"}]}}',
      } }),
      [{ name: 'weather' }],
    )).toThrowError(/declare them once/);
    const kept = buildGPTLiveDelegation(
      config({ options: {
        delegation: '{"type":"responses","responses":{"model":"gpt-5.2","tools":[{"type":"web_search"}]}}',
      } }), [],
    );
    expect(((kept?.responses as Record<string, unknown>).tools as Array<Record<string, unknown>>)[0].type)
      .toBe('web_search');
  });

  it('refuses browser-held API keys and non-live sample rates', async () => {
    await expect(connectGPTLive({
      config: config(),
      transport: { kind: 'server', apiKey: 'sk-secret' },
      browserEnvironment: true,
      socketFactory: () => new FakeSocket(),
    })).rejects.toMatchObject({ code: 'credential-boundary' });
    await expect(connectGPTLive({
      config: config({ inputSampleRate: 8_000 }),
      transport: { kind: 'relay', url: 'wss://relay.example' },
      socketFactory: () => new FakeSocket(),
    })).rejects.toMatchObject({ code: 'invalid-configuration' });
  });

  it('appends audio and instructions with the documented payloads', async () => {
    const { socket, session } = await connect();
    await session.sendAudio(new Uint8Array([1, 2, 3, 4]));
    await session.appendInstruction('Wrap up.');
    expect(socket.sent[1]).toEqual({ type: 'session.input_audio.append', audio: 'AQIDBA==' });
    expect(socket.sent[2]).toEqual({
      type: 'session.instructions.append',
      content: 'Wrap up.',
      delegation_id: null,
    });
    await expect(session.sendAudio(new Uint8Array([1]))).rejects.toMatchObject({ code: 'invalid-audio-chunk' });
  });

  it('returns every output before one response.create, across delegation rounds', async () => {
    const { socket, session } = await connect({ tools: [{ name: 'weather' }] });
    const reader = eventReader(session);
    await reader.next(); // ready
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.created', response: { id: 'r1' } } });
    pushCall(socket, 'd1', 'c1');
    pushCall(socket, 'd1', 'c2');
    await reader.next(); // delegationStarted
    await reader.next(); // toolCall c1
    await reader.next(); // toolCall c2
    await session.sendToolResult({
      callId: 'c1', name: 'weather', output: { ok: true, value: {} }, delegationId: 'd1',
    });
    expect(socket.sentTypes().filter((type) => type === 'response.create')).toHaveLength(0);
    expect(socket.sent.find((m) => m.type === 'response.item.create')?.delegation_id).toBeUndefined();
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.completed', response: { id: 'r1' } } });
    await flush();
    await session.sendToolResult({
      callId: 'c2', name: 'weather', output: { ok: false, error: 'No data.' }, delegationId: 'd1',
    });
    await flush();
    expect(socket.sentTypes().filter((type) => type === 'response.create')).toHaveLength(1);

    // Round two on the same delegation continues again.
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.created', response: { id: 'r2' } } });
    pushCall(socket, 'd1', 'c3');
    await reader.next(); // toolCall c3
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.completed', response: { id: 'r2' } } });
    await flush();
    await session.sendToolResult({
      callId: 'c3', name: 'weather', output: { ok: true, value: {} }, delegationId: 'd1',
    });
    await flush();
    expect(socket.sentTypes().filter((type) => type === 'response.create')).toHaveLength(2);
  });

  it('is idempotent for duplicate created/calls and ignores stale completions', async () => {
    const { socket, session } = await connect({ tools: [{ name: 'weather' }] });
    const reader = eventReader(session);
    await reader.next(); // ready
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.created', response: { id: 'r1' } } });
    pushCall(socket, 'd1', 'c1');
    await reader.next(); // delegationStarted
    await reader.next(); // toolCall c1
    // Duplicate created for the same response must not reset pending calls.
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.created', response: { id: 'r1' } } });
    // Duplicate delivery must not re-announce.
    pushCall(socket, 'd1', 'c1');
    // A stale completion for an earlier response must not bound this round.
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.created', response: { id: 'r2' } } });
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.completed', response: { id: 'r1' } } });
    pushCall(socket, 'd1', 'c9');
    const call = await reader.next();
    if (call.type !== 'toolCall') throw new Error('expected call');
    expect(call.call.id).toBe('c9');
    await expect(session.sendToolResult({
      callId: 'c1', name: 'weather', output: { ok: true, value: {} }, delegationId: 'd1',
    })).rejects.toMatchObject({ code: 'unknown-tool-call' });
  });

  it('keeps missing or non-string wire arguments invalid instead of fabricating {}', async () => {
    const { socket, session } = await connect({ tools: [{ name: 'weather' }] });
    const reader = eventReader(session);
    await reader.next(); // ready
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'c1', name: 'weather' } } });
    socket.push({ type: 'response.event', delegation_id: 'd1',
      event: { type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'c2', name: 'weather', arguments: { query: 'x' } } } });
    await reader.next(); // delegationStarted
    const missing = await reader.next();
    if (missing.type !== 'toolCall') throw new Error('expected call');
    expect(missing.call.args).toBeUndefined();
    const objectArgs = await reader.next();
    if (objectArgs.type !== 'toolCall') throw new Error('expected call');
    // Present-but-non-string is wire-invalid; it must not become an accepted object.
    expect(objectArgs.call.args).toBeUndefined();
  });

  it('routes client-delegation results as commentary with the opaque ID', async () => {
    const { socket, session } = await connect();
    const reader = eventReader(session);
    await reader.next(); // ready
    socket.push({ type: 'session.delegation.created',
      delegation: { id: 'd7', type: 'task', target: 'client' } });
    expect(await reader.next()).toEqual({
      type: 'delegationStarted', delegation: { id: 'd7', target: 'client' },
    });
    await session.sendToolResult({
      callId: 'd7', name: 'commentary', output: { ok: true, value: 'Found it.' }, delegationId: 'd7',
    });
    expect(socket.sent[1]).toEqual({
      type: 'session.commentary.append', content: '"Found it."', delegation_id: 'd7',
    });
  });

  it('closes gracefully with usage, shares one close, and fails an unconfirmed close', async () => {
    const { socket, session } = await connect();
    const reader = eventReader(session);
    await reader.next(); // ready
    const closing = Promise.all([session.close(), session.close()]);
    await flush();
    socket.push({ type: 'session.closed', usage: { voice_seconds: 12.5 } });
    await closing;
    expect(socket.sentTypes().filter((type) => type === 'session.close')).toHaveLength(1);
    expect(await reader.next()).toEqual({ type: 'closed', usage: { voice_seconds: 12.5 } });
    expect(await reader.ended()).toBe(true);

    const silent = new FakeSocket();
    const { session: hanging } = await connect({ socket: silent });
    const hangingReader = eventReader(hanging);
    await hangingReader.next(); // ready
    await hanging.close();
    const failure = await hangingReader.failure();
    expect((failure as ConversationError).code).toBe('close-unconfirmed');
  });

  it('sanitizes provider errors to fixed copy', async () => {
    const { socket, session } = await connect();
    const reader = eventReader(session);
    await reader.next(); // ready
    socket.push({ type: 'error', error: { message: 'secret internals' } });
    const failure = await reader.failure();
    expect((failure as ConversationError).message).toBe('The provider reported an error.');
  });

  it('connects over WebRTC with listeners installed before the answer applies', async () => {
    const channel = new FakeSocket();
    (channel as { readyState: unknown }).readyState = 'open';
    const steps: string[] = [];
    const holder: { exchanged?: Record<string, unknown> } = {};
    const peer: RTCPeerConnectionLike = {
      createDataChannel: (label) => {
        steps.push(`channel:${label}`);
        return {
          send: (data) => channel.send(data),
          close: () => channel.close(),
          addEventListener: (type, listener) => channel.addEventListener(type, listener),
          readyState: 'open',
        };
      },
      addTrack: () => steps.push('track'),
      createOffer: async () => {
        steps.push('offer');
        return { sdp: 'offer-sdp' };
      },
      setLocalDescription: async () => {
        steps.push('local');
      },
      setRemoteDescription: async () => {
        // An early session.started right as the answer applies must land in
        // already-installed listeners.
        channel.push({ type: 'session.started', session: { id: 'live_rtc' } });
        steps.push('remote');
      },
      addEventListener: () => {},
      close: () => steps.push('peer-close'),
    };
    const session = await connectGPTLiveWebRTC({
      config: config({ options: {} }),
      exchange: async (request) => {
        holder.exchanged = request as unknown as Record<string, unknown>;
        return { answerSdp: 'answer-sdp' };
      },
      createPeerConnection: () => peer,
    });
    expect(holder.exchanged?.offerSdp).toBe('offer-sdp');
    expect((holder.exchanged?.session as Record<string, unknown>).model).toBe('gpt-live-1');
    const reader = eventReader(session);
    expect(await reader.next()).toEqual({ type: 'ready', sessionId: 'live_rtc' });
    // Audio rides the media tracks, not the data channel.
    await expect(session.sendAudio(new Uint8Array([1, 2]))).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('cancels a stalled WebRTC exchange and cleans up the peer', async () => {
    const controller = new AbortController();
    let closedPeer = false;
    const peer: RTCPeerConnectionLike = {
      createDataChannel: () => new FakeSocket() as never,
      addTrack: () => {},
      createOffer: async () => ({ sdp: 'offer' }),
      setLocalDescription: async () => {},
      setRemoteDescription: async () => {},
      addEventListener: () => {},
      close: () => {
        closedPeer = true;
      },
    };
    const opening = connectGPTLiveWebRTC({
      config: config({ options: {} }),
      exchange: () => new Promise(() => {}),
      createPeerConnection: () => peer,
      signal: controller.signal,
    });
    await flush();
    controller.abort();
    await expect(opening).rejects.toMatchObject({ code: 'cancelled' });
    expect(closedPeer).toBe(true);
  });
});
