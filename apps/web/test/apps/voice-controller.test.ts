import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceController, type VoiceDependencies } from '../../app/apps/hudson-voice/VoiceController';
import type { ConversationEvent, ConversationSession } from '@hudsonkit/ai/conversation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function microphone(label = 'Yeti') {
  const track = { kind: 'audio', label, enabled: true, stop: vi.fn(), addEventListener: vi.fn() };
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream };
}
function fixture() {
  const pending: ConversationEvent[] = [];
  let wake = deferred<void>();
  let closed = false;
  const push = (event: ConversationEvent) => { pending.push(event); wake.resolve(); };
  const finish = () => { closed = true; wake.resolve(); };
  const session: ConversationSession = {
    events: { async *[Symbol.asyncIterator]() {
      while (!closed) {
        while (pending.length) yield pending.shift()!;
        if (!closed) { await wake.promise; wake = deferred<void>(); }
      }
    } },
    close: vi.fn(async () => finish()), interruptPlayback: vi.fn(() => 1),
    sendAudio: vi.fn(), finishAudio: vi.fn(), appendInstruction: vi.fn(), sendToolResult: vi.fn(),
  };
  const first = microphone();
  const sender = { track: first.track, replaceTrack: vi.fn(async () => {}) };
  const peer = { getSenders: () => [sender], close: vi.fn() };
  const audio = { muted: false, autoplay: false, srcObject: null, play: vi.fn(async () => {}), pause: vi.fn() };
  const getUserMedia = vi.fn(async () => first.stream);
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ ready: true, message: 'Ready', sessionLimitSeconds: 90,
    config: { provider: 'openai-gpt-live', model: 'gpt-live-1', inputSampleRate: 24000, options: { delegationModel: 'fixture' } },
  })));
  const connect = vi.fn(async (options: Parameters<VoiceDependencies['connect']>[0]) => {
    options.createPeerConnection?.();
    return session;
  });
  const controller = new VoiceController(() => ({ media: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    fetch: fetcher as unknown as typeof fetch, createPeer: () => peer as unknown as RTCPeerConnection,
    createAudio: () => audio as unknown as HTMLAudioElement, createStream: () => first.stream,
    connect: connect as VoiceDependencies['connect'],
  }));
  return { controller, first, sender, peer, audio, getUserMedia, fetcher, connect, session, push, finish };
}
const active: VoiceController[] = [];
async function ready() { const f = fixture(); active.push(f.controller); await f.controller.refreshAvailability(); return f; }
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
afterEach(async () => { for (const controller of active.splice(0)) await controller.disconnect(); vi.useRealTimers(); });

describe('Voice controller lifecycle', () => {
  it('captures the selected microphone exactly and ignores duplicate starts', async () => {
    const f = await ready();
    await f.controller.selectMicrophone('usb');
    await Promise.all([f.controller.connect(), f.controller.connect()]);
    expect(f.getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: { deviceId: { exact: 'usb' } } });
    expect(f.connect).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().actualMicrophone).toBe('Yeti');
  });
  it('switches the outgoing track without a new session and preserves mic mute', async () => {
    const f = await ready(); await f.controller.connect(); f.controller.toggleMicrophone();
    const second = microphone('Headset'); f.getUserMedia.mockResolvedValueOnce(second.stream);
    await f.controller.selectMicrophone('headset');
    expect(f.sender.replaceTrack).toHaveBeenCalledWith(second.track);
    expect(second.track.enabled).toBe(false);
    expect(f.first.track.stop).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot()).toMatchObject({ selectedDeviceId: 'headset', actualMicrophone: 'Headset', microphoneMuted: true });
    expect(f.connect).toHaveBeenCalledOnce();
  });
  it('keeps the previous microphone when replacement fails and releases the rejected track', async () => {
    const f = await ready(); await f.controller.connect();
    const second = microphone('Unavailable'); f.getUserMedia.mockResolvedValueOnce(second.stream);
    f.sender.replaceTrack.mockRejectedValueOnce(new Error('device gone'));
    await f.controller.selectMicrophone('missing');
    expect(f.first.track.stop).not.toHaveBeenCalled();
    expect(second.track.stop).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot()).toMatchObject({ actualMicrophone: 'Yeti', selectedDeviceId: '', phase: 'connected' });
  });
  it('releases a capture that arrives after End without creating a session', async () => {
    const f = await ready(); const capture = deferred<MediaStream>();
    f.getUserMedia.mockReturnValueOnce(capture.promise);
    const opening = f.controller.connect(); await f.controller.disconnect();
    capture.resolve(f.first.stream); await opening;
    expect(f.first.track.stop).toHaveBeenCalledOnce();
    expect(f.connect).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().phase).toBe('idle');
  });
  it('releases a replacement arriving after End', async () => {
    const f = await ready(); await f.controller.connect();
    const capture = deferred<MediaStream>(); const second = microphone('Late'); f.getUserMedia.mockReturnValueOnce(capture.promise);
    const switching = f.controller.selectMicrophone('late'); await f.controller.disconnect(); capture.resolve(second.stream); await switching;
    expect(second.track.stop).toHaveBeenCalledOnce(); expect(f.sender.replaceTrack).not.toHaveBeenCalled();
  });
  it('releases local resources after connection failure', async () => {
    const f = await ready(); f.connect.mockRejectedValueOnce(new Error('private provider detail'));
    await f.controller.connect();
    expect(f.first.track.stop).toHaveBeenCalledOnce(); expect(f.audio.pause).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().phase).toBe('error');
    expect(f.controller.getSnapshot().message).not.toContain('private');
  });
  it('stops microphone and playback when the provider event stream finishes', async () => {
    const f = await ready(); await f.controller.connect(); f.finish(); await settle();
    expect(f.first.track.stop).toHaveBeenCalledOnce(); expect(f.audio.muted).toBe(true); expect(f.peer.close).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().phase).toBe('idle');
  });
  it('keeps interruption distinct from mic mute and delivers tool results', async () => {
    const f = await ready(); await f.controller.connect();
    f.push({ type: 'toolCall', call: { id: 'count-1', name: 'count_words', args: { text: 'one two three' } } });
    f.controller.interrupt(); await settle();
    expect(f.audio.muted).toBe(true); expect(f.first.track.enabled).toBe(true);
    expect(f.session.sendToolResult).toHaveBeenCalledWith(expect.objectContaining({ callId: 'count-1', output: { ok: true, value: { words: 3 } } }));
    expect(f.controller.getSnapshot().tools[0].status).toBe('complete');
    await f.controller.resumePlayback(); expect(f.audio.muted).toBe(false);
  });
  it('groups transcript deltas and separates subsequent turns', async () => {
    const f = await ready(); await f.controller.connect();
    f.push({ type: 'assistantTranscriptDelta', text: 'Hello ' }); f.push({ type: 'assistantTranscriptDelta', text: 'there.' });
    f.push({ type: 'turnComplete' }); f.push({ type: 'assistantTranscriptDelta', text: 'Next turn.' }); await settle();
    await vi.waitFor(() => expect(f.controller.getSnapshot().transcript.map(t => t.text)).toEqual(['Hello there.', 'Next turn.']));
  });
  it('ends at the bounded session limit', async () => {
    vi.useFakeTimers(); const f = await ready(); await f.controller.connect(); await vi.advanceTimersByTimeAsync(90_000);
    expect(f.controller.getSnapshot().phase).toBe('idle'); expect(f.first.track.stop).toHaveBeenCalledOnce();
  });
});
