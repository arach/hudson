import {
  connectGPTLiveWebRTC, startWebRTCEventHost,
  type ConversationSession, type ConversationEvent, type RTCPeerConnectionLike, type WebRTCEventHost,
} from '@hudsonkit/ai/conversation';
import { countWordsTool, voiceDispatcher } from './voice-tools';
import type { VoiceState, VoiceAvailability, VoiceTranscript } from './voice-types';

const API = { status: '/api/conversation/status', session: '/api/conversation/session' } as const;
export interface VoiceDependencies {
  media: Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'>;
  fetch: typeof fetch;
  createPeer(): RTCPeerConnection;
  createAudio(): HTMLAudioElement;
  createStream(track: MediaStreamTrack): MediaStream;
  connect: typeof connectGPTLiveWebRTC;
}
/** Owns one conversation. Browser capabilities are injected only at activation. */
export class VoiceController {
  private state: VoiceState = {
    phase: 'idle', availability: { ready: false, message: 'Checking connection…', sessionLimitSeconds: 90 },
    loading: true, message: '', devices: [], selectedDeviceId: '', actualMicrophone: '',
    selectingMicrophone: false, microphoneMuted: false, playbackMuted: false, playbackBlocked: false,
    elapsedSeconds: 0, transcript: [], tools: [],
  };
  private listeners = new Set<() => void>();
  private run = 0;
  private inventory = 0;
  private availabilityRevision = 0;
  private microphone?: MediaStream;
  private audio?: HTMLAudioElement;
  private peer?: RTCPeerConnection;
  private host?: WebRTCEventHost;
  private session?: ConversationSession;
  private request?: AbortController;
  private clock?: ReturnType<typeof setInterval>;
  private nextTranscript = 0;
  private splitTranscript = false;
  constructor(private readonly dependencies: () => VoiceDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<VoiceState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private busy() { return this.state.phase === 'connecting' || this.state.phase === 'connected' || this.state.phase === 'disconnecting'; }
  refreshAvailability = async () => {
    const revision = ++this.availabilityRevision;
    this.update({ loading: true });
    try {
      const response = await this.dependencies().fetch(API.status, { cache: 'no-store' });
      if (!response.ok) throw new Error('Voice is available from a local Hudson portal.');
      const value: VoiceAvailability = await response.json();
      if (revision === this.availabilityRevision) this.update({ availability: value });
    } catch {
      if (revision === this.availabilityRevision) this.update({ availability: { ready: false, message: 'Voice is unavailable. Open a local Hudson portal and check its server credentials.', sessionLimitSeconds: 90 } });
    } finally { if (revision === this.availabilityRevision) this.update({ loading: false }); }
  };
  listMicrophones = async () => {
    const revision = ++this.inventory;
    const inputs = (await this.dependencies().media.enumerateDevices()).filter(device => device.kind === 'audioinput');
    if (revision !== this.inventory) return;
    this.update({ devices: inputs.filter(device => device.deviceId).map((device, index) => ({ id: device.deviceId, label: device.label || `Microphone ${index + 1}` })) });
  };
  refreshMicrophones = async () => {
    if (this.state.selectingMicrophone || this.state.phase === 'connecting') return;
    const run = this.run;
    this.update({ selectingMicrophone: true, message: '' });
    let probe: MediaStream | undefined;
    try {
      if (!this.microphone) probe = await this.dependencies().media.getUserMedia({ audio: true });
      if (run !== this.run) return;
      await this.listMicrophones();
    } catch { if (run === this.run) this.update({ message: 'Allow microphone access in your browser, then refresh the microphone list.' }); }
    finally { probe?.getTracks().forEach(track => track.stop()); this.update({ selectingMicrophone: false }); }
  };
  private capture(id: string) { return this.dependencies().media.getUserMedia({ audio: id ? { deviceId: { exact: id } } : true }); }
  private attachMicrophone(stream: MediaStream) {
    this.microphone = stream;
    const track = stream.getAudioTracks()[0];
    track.enabled = !this.state.microphoneMuted;
    this.update({ actualMicrophone: track.label || 'System default microphone' });
    track.addEventListener('ended', () => {
      if (this.microphone !== stream) return;
      void this.end('Microphone disconnected. Choose another microphone and reconnect.');
    });
  }
  selectMicrophone = async (id: string) => {
    if (this.state.selectingMicrophone || this.state.phase === 'connecting' || this.state.phase === 'disconnecting') return;
    if (!this.microphone) { this.update({ selectedDeviceId: id, message: '' }); return; }
    const previous = this.state.selectedDeviceId;
    const oldStream = this.microphone;
    const run = this.run;
    const sender = this.peer?.getSenders().find(item => item.track?.kind === 'audio');
    this.update({ selectingMicrophone: true, message: '' });
    let captured: MediaStream | undefined;
    try {
      if (!sender) throw new Error('No outgoing audio');
      captured = await this.capture(id);
      if (run !== this.run) return;
      const track = captured.getAudioTracks()[0];
      if (!track) throw new Error('No microphone track');
      track.enabled = !this.state.microphoneMuted;
      await sender.replaceTrack(track);
      if (run !== this.run) return;
      this.attachMicrophone(captured); captured = undefined;
      oldStream.getTracks().forEach(item => item.stop());
      this.update({ selectedDeviceId: id });
    } catch { if (run === this.run) this.update({ selectedDeviceId: previous, message: 'Could not switch microphones. Your previous microphone is still active.' }); }
    finally { captured?.getTracks().forEach(track => track.stop()); this.update({ selectingMicrophone: false }); }
  };
  private appendTranscript(role: VoiceTranscript['role'], text: string) {
    const items = [...this.state.transcript];
    const last = items.at(-1);
    if (!this.splitTranscript && last?.role === role) items[items.length - 1] = { ...last, text: (last.text + text).slice(-16_000) };
    else items.push({ id: ++this.nextTranscript, role, text });
    this.splitTranscript = false;
    this.update({ transcript: items.slice(-200) });
  }
  connect = async () => {
    if (this.busy() || this.state.selectingMicrophone || !this.state.availability.ready) return;
    const config = this.state.availability.config;
    if (!config) return;
    const run = ++this.run;
    const active = () => run === this.run;
    const deps = this.dependencies();
    this.request = new AbortController();
    const signal = this.request.signal;
    this.update({ phase: 'connecting', message: '', microphoneMuted: false, playbackMuted: false, playbackBlocked: false, elapsedSeconds: 0 });
    this.splitTranscript = true;
    try {
      const stream = await this.capture(this.state.selectedDeviceId);
      if (!active()) { stream.getTracks().forEach(track => track.stop()); return; }
      if (!stream.getAudioTracks()[0]) { stream.getTracks().forEach(track => track.stop()); throw new Error('No audio input'); }
      this.attachMicrophone(stream);
      void this.listMicrophones().catch(() => {});
      const audio = deps.createAudio(); this.audio = audio; audio.autoplay = true;
      const session = await deps.connect({ config, tools: [countWordsTool], microphone: stream,
        createPeerConnection: () => { const peer = deps.createPeer(); this.peer = peer; return peer as unknown as RTCPeerConnectionLike; },
        onRemoteAudioTrack: track => {
          if (!active()) return;
          audio.srcObject = deps.createStream(track as MediaStreamTrack);
          audio.muted = this.state.playbackMuted;
          void audio.play().catch(() => { if (active()) this.update({ playbackBlocked: true }); });
        },
        exchange: async request => {
          const response = await deps.fetch(API.session, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', signal, body: JSON.stringify({ sdp: request.offerSdp }) });
          if (!response.ok) throw new Error('Connection refused');
          const answer = await response.json() as { sdp: string; sessionId?: string };
          return { answerSdp: answer.sdp, sessionId: answer.sessionId };
        },
      });
      if (!active()) { await session.close().catch(() => {}); return; }
      this.session = session;
      const markTurn = () => { this.splitTranscript = true; };
      const cancelTools = (ids: string[]) => this.update({ tools: this.state.tools.map(tool => ids.includes(tool.id) && tool.status === 'running' ? { ...tool, status: 'cancelled', detail: 'Cancelled by the provider.' } : tool) });
      const endSession = (message: string, failed = false) => this.end(message, failed);
      const events: AsyncIterable<ConversationEvent> = { async *[Symbol.asyncIterator]() {
        try {
          for await (const event of session.events) {
            if (!active()) break;
            if (event.type === 'turnComplete') markTurn();
            if (event.type === 'toolCallsCancelled') cancelTools(event.ids);
            yield event;
          }
        } catch (error) {
          if (active()) void endSession('Connection lost. Your microphone has stopped; reconnect to try again.', true);
          throw error;
        } finally { if (active()) void endSession('Session ended. You can reconnect.'); }
      } };
      const observed: ConversationSession = Object.create(session);
      Object.defineProperty(observed, 'events', { value: events });
      observed.sendToolResult = async result => {
        await session.sendToolResult(result);
        if (active()) this.update({ tools: this.state.tools.map(tool => tool.id === result.callId && tool.status === 'running' ? { ...tool, status: result.output.ok ? 'complete' : 'failed', detail: result.output.ok ? 'Result delivered to the conversation.' : 'The tool rejected this request.' } : tool) });
      };
      // Bind prototype methods to the real session, preserving private state.
      observed.close = () => session.close(); observed.interruptPlayback = () => session.interruptPlayback();
      const dispatcher = voiceDispatcher();
      const instrumented = { ...dispatcher, dispatch: async (...args: Parameters<typeof dispatcher.dispatch>) => {
        if (active()) this.update({ tools: [...this.state.tools, { id: args[0].id, name: args[0].name, status: 'running' as const, detail: 'Running locally in this browser.' }].slice(-50) });
        return dispatcher.dispatch(...args);
      } };
      this.host = startWebRTCEventHost({ session: observed, dispatcher: instrumented,
        muteRemoteAudio: () => { audio.muted = true; if (active()) this.update({ playbackMuted: true }); },
        unmuteRemoteAudio: () => { if (active()) { audio.muted = false; this.update({ playbackMuted: false }); } },
        onUserTranscript: text => { if (active()) this.appendTranscript('user', text); },
        onAssistantTranscript: text => { if (active()) this.appendTranscript('assistant', text); },
        onError: () => { if (active()) void this.end('Connection lost. Your microphone has stopped; reconnect to try again.', true); },
      });
      this.update({ phase: 'connected' });
      const started = Date.now();
      this.clock = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - started) / 1000);
        if (!active()) return;
        this.update({ elapsedSeconds });
        if (elapsedSeconds >= this.state.availability.sessionLimitSeconds) void this.end('Session time limit reached. Reconnect to continue.');
      }, 250);
    } catch {
      if (active()) await this.end('Could not connect. Check microphone permission, the selected device, and server setup, then try again.', true);
    }
  };
  private async end(message = '', failed = false) {
    const run = ++this.run;
    this.request?.abort(); this.request = undefined;
    clearInterval(this.clock); this.clock = undefined;
    const microphone = this.microphone; this.microphone = undefined;
    microphone?.getTracks().forEach(track => track.stop());
    if (this.audio) { this.audio.muted = true; this.audio.pause(); this.audio.srcObject = null; this.audio = undefined; }
    const host = this.host; this.host = undefined;
    const session = this.session; this.session = undefined;
    const peer = this.peer; this.peer = undefined;
    this.update({ phase: 'disconnecting', actualMicrophone: '', microphoneMuted: false, playbackBlocked: false, playbackMuted: true,
      tools: this.state.tools.map(tool => tool.status === 'running' ? { ...tool, status: 'cancelled', detail: 'Session ended before delivery.' } : tool) });
    try { if (host) await host.stop(); else await session?.close(); } catch { message ||= 'Local audio stopped. The provider did not acknowledge closure.'; }
    finally { peer?.close(); if (run === this.run) this.update({ phase: failed ? 'error' : 'idle', message }); }
  }
  disconnect = () => this.end('Session ended.');
  toggleMicrophone = () => {
    if (this.state.phase !== 'connected') return;
    const muted = !this.state.microphoneMuted;
    this.microphone?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.update({ microphoneMuted: muted });
  };
  interrupt = () => { if (this.state.phase === 'connected') this.host?.bargeIn(); };
  resumePlayback = async () => {
    if (this.state.phase !== 'connected' || !this.audio) return;
    const run = this.run;
    this.host?.resumeRemoteAudio();
    try { await this.audio.play(); if (run === this.run) this.update({ playbackBlocked: false }); }
    catch { if (run === this.run) this.update({ playbackBlocked: true, message: 'Playback was blocked. Choose Resume playback to allow audio.' }); }
  };
  clearTranscript = () => { if (!this.busy()) this.update({ transcript: [], tools: [] }); };
}
