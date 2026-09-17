import { ConversationError, type AssistantAudioChunk, type ConversationEvent, type ConversationSession } from '../types';
import { createToolDispatcher, type ToolDispatcher } from '../dispatcher';

// ---------------------------------------------------------------------------
// Sample browser hosts — real callers, not interfaces.
//
// `startBrowserConversation` is the PCM host for WebSocket sessions: it
// captures microphone PCM, plays assistant PCM with generation-aware
// barge-in (scheduled sources are stopped, not just re-pointed), and
// dispatches tools. `startWebRTCEventHost` is the separate host for WebRTC
// sessions, where audio rides media tracks and only events need wiring.
//
// Ownership: a supplied AudioContext and the microphone stream belong to the
// caller and are never closed/stopped here; a context this module created is
// closed on stop. Capture uses a ScriptProcessorNode for dependency-free
// brevity — a production host would use an AudioWorklet.
// ---------------------------------------------------------------------------

/** The narrow AudioContext surface this host uses; injectable for fixtures. */
export interface AudioContextLike {
  sampleRate: number;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createMediaStreamSource(stream: unknown): {
    connect(node: unknown): void;
    disconnect(): void;
  };
  createScriptProcessor(size: number, inputs: number, outputs: number): {
    onaudioprocess: ((event: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null;
    connect(node: unknown): void;
    disconnect(): void;
  };
  createBuffer(channels: number, frames: number, sampleRate: number): {
    duration: number;
    getChannelData(channel: number): Float32Array;
  };
  createBufferSource(): {
    buffer: unknown;
    onended: (() => void) | null;
    connect(node: unknown): void;
    start(at: number): void;
    stop(): void;
    disconnect(): void;
  };
}

export interface BrowserConversationHost {
  /** Stop local playback now; queued and in-flight stale audio is dropped. */
  bargeIn(): void;
  /** Chunks dropped because the playback queue bound was reached. */
  droppedChunks(): number;
  /** Stop capture, close the session gracefully, release audio resources. */
  stop(): Promise<void>;
}

export async function startBrowserConversation(options: {
  session: ConversationSession;
  dispatcher?: ToolDispatcher;
  /** Host-owned; its tracks are not stopped here. */
  microphone: { stream: unknown } | MediaStream;
  inputSampleRate: number;
  /** Host-owned when supplied; otherwise created and closed internally. */
  audioContext?: AudioContextLike;
  /** Queue bound: how far ahead playback may be scheduled, in seconds. */
  maxQueuedSeconds?: number;
  onUserTranscript?: (delta: string) => void;
  onAssistantTranscript?: (delta: string) => void;
  onError?: (error: unknown) => void;
}): Promise<BrowserConversationHost> {
  const { session } = options;
  if (!Number.isFinite(options.inputSampleRate) || options.inputSampleRate <= 0) {
    throw new ConversationError('invalid-configuration', 'The input sample rate must be a positive number.');
  }
  const dispatcher = options.dispatcher ?? createToolDispatcher();
  const ownsContext = options.audioContext === undefined;
  const context: AudioContextLike =
    options.audioContext ?? (new AudioContext() as unknown as AudioContextLike);
  const maxQueuedSeconds = options.maxQueuedSeconds ?? 30;
  let stopped = false;
  let dropped = 0;
  let audioReleased = false;

  // Playback bookkeeping is declared before wiring so every failure path can
  // release it.
  let playbackGeneration = 0;
  let playhead = 0;
  const liveNodes = new Set<ReturnType<AudioContextLike['createBufferSource']>>();
  const stopPlayback = () => {
    for (const node of liveNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // A node that already ended cannot be stopped again.
      }
    }
    liveNodes.clear();
    playhead = 0;
  };

  let capture: { source: { disconnect(): void }; processor: { disconnect(): void } } | null = null;
  const releaseAudio = async () => {
    if (audioReleased) return;
    audioReleased = true;
    capture?.processor.disconnect();
    capture?.source.disconnect();
    stopPlayback();
    if (ownsContext) await context.close().catch(() => {});
  };

  const cancelledCalls = new Set<string>();
  const handledCalls = new Set<string>();
  const inFlightCalls = new Set<string>();

  let cleanup: Promise<void> | null = null;
  const shutdown = (graceful: boolean): Promise<void> => {
    cleanup ??= (async () => {
      stopped = true;
      // In-flight dispatch is cancelled so a result resolving after stop can
      // neither run late effects nor reach a dead session.
      dispatcher.cancel([...inFlightCalls]);
      // Stop audible/capture work before waiting for a network acknowledgement.
      await releaseAudio();
      try {
        if (graceful) {
          try {
            await session.finishAudio();
          } catch {
            // The session may already be closed; finishing is best-effort.
          }
        }
        await session.close();
      } finally {
        // Cleanup is not hostage to a close that failed while the stream
        // stayed open; the pump re-runs the idempotent release when it ends.
        await releaseAudio();
      }
    })();
    return cleanup;
  };

  try {
    // Autoplay policies suspend fresh contexts until a user gesture; a
    // context that cannot resume is a startup failure, not a silent state.
    await context.resume();

    // Capture: mic → mono PCM16 at the session rate, with a fractional read
    // cursor carried across buffers so resampling drops no remainder.
    const source = context.createMediaStreamSource(options.microphone);
    const processor = context.createScriptProcessor(4096, 1, 1);
    capture = { source, processor };
    const ratio = context.sampleRate / options.inputSampleRate;
    let readCursor = 0;
    processor.onaudioprocess = (event) => {
      if (stopped) return;
      const input = event.inputBuffer.getChannelData(0);
      const samples: number[] = [];
      while (readCursor < input.length) {
        const sample = Math.max(-1, Math.min(1, input[Math.floor(readCursor)]));
        samples.push(Math.round(sample * 0x7fff));
        readCursor += ratio;
      }
      readCursor -= input.length;
      if (samples.length === 0) return;
      const pcm = new Uint8Array(samples.length * 2);
      const view = new DataView(pcm.buffer);
      for (let index = 0; index < samples.length; index += 1) view.setInt16(index * 2, samples[index], true);
      void session.sendAudio(pcm).catch((error) => {
        // A dead input path must not leave a live billing session hanging.
        options.onError?.(error);
        shutdown(false).catch((failure) => options.onError?.(failure));
      });
    };
    source.connect(processor);
    processor.connect(context.destination);
  } catch (error) {
    // Startup failure releases everything this call created, session included.
    await releaseAudio();
    await session.close().catch(() => {});
    throw error;
  }

  const playChunk = (chunk: AssistantAudioChunk) => {
    if (chunk.generation < playbackGeneration) return;
    playbackGeneration = chunk.generation;
    if (chunk.data.byteLength === 0 || chunk.data.byteLength % 2 !== 0) {
      options.onError?.(new ConversationError('invalid-audio-chunk', 'Malformed PCM chunk was dropped.'));
      return;
    }
    const frames = chunk.data.byteLength / 2;
    const chunkDuration = frames / chunk.sampleRate;
    // The bound covers what is queued plus what this chunk would add.
    const queuedAhead = Math.max(0, playhead - context.currentTime);
    if (queuedAhead + chunkDuration > maxQueuedSeconds) {
      dropped += 1;
      return;
    }
    const buffer = context.createBuffer(1, frames, chunk.sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
    for (let frame = 0; frame < frames; frame += 1) {
      channel[frame] = view.getInt16(frame * 2, true) / 0x8000;
    }
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(context.destination);
    liveNodes.add(node);
    node.onended = () => {
      liveNodes.delete(node);
    };
    const startAt = Math.max(context.currentTime, playhead);
    node.start(startAt);
    playhead = startAt + buffer.duration;
  };

  const handleEvent = (event: ConversationEvent) => {
    // Events buffered behind a stop must not start new tools or playback
    // while the host is shutting down.
    if (stopped) return;
    switch (event.type) {
      case 'assistantAudio':
        playChunk(event.chunk);
        break;
      case 'interrupted':
        playbackGeneration = event.generation;
        stopPlayback();
        break;
      case 'userTranscriptDelta':
        options.onUserTranscript?.(event.text);
        break;
      case 'assistantTranscriptDelta':
        options.onAssistantTranscript?.(event.text);
        break;
      case 'toolCall': {
        // One dispatch per call ID, ever; results after stop or provider
        // withdrawal are suppressed instead of racing.
        if (handledCalls.has(event.call.id)) break;
        handledCalls.add(event.call.id);
        inFlightCalls.add(event.call.id);
        void dispatcher.dispatch(event.call)
          .then((result) => {
            inFlightCalls.delete(result.callId);
            if (stopped || cancelledCalls.has(result.callId)) return undefined;
            return session.sendToolResult(result);
          })
          .catch((error) => {
            // A result that cannot be delivered leaves the provider waiting;
            // the session is closed rather than silently degraded.
            options.onError?.(error);
            shutdown(false).catch((failure) => options.onError?.(failure));
          });
        break;
      }
      case 'toolCallsCancelled':
        for (const id of event.ids) cancelledCalls.add(id);
        dispatcher.cancel(event.ids);
        break;
      default:
        break;
    }
  };

  const pump = (async () => {
    try {
      for await (const event of session.events) handleEvent(event);
    } catch (error) {
      options.onError?.(error);
      // A failed stream still closes the provider side deterministically.
      await session.close().catch(() => {});
    } finally {
      // A session that ends on its own — gracefully or not — still cancels
      // pending dispatch and releases capture/playback.
      stopped = true;
      dispatcher.cancel([...inFlightCalls]);
      await releaseAudio();
    }
  })();

  return {
    bargeIn() {
      playbackGeneration = session.interruptPlayback();
      stopPlayback();
    },
    droppedChunks: () => dropped,
    stop: () => shutdown(true),
  };
}

// ---------------------------------------------------------------------------
// WebRTC host: audio rides negotiated media tracks (microphone was published
// at connect time; assistant speech arrives as a remote track the host
// attaches to an audio element), so this host wires events and tools only.
// Barge-in needs a concrete audible effect: pass `muteRemoteAudio`, wired to
// pausing/muting the element playing the remote track — the generation
// marker alone silences nothing over WebRTC.
// ---------------------------------------------------------------------------

export interface WebRTCEventHost {
  /** Stops audible remote playback via the host hook and marks a barge-in. */
  bargeIn(): void;
  /**
   * Re-enable remote playback after a barge-in or provider interruption.
   * Muting is a LOCAL, honest effect only — the provider keeps its own turn
   * handling — and nothing unmutes automatically: the caller decides when
   * (typically when the user finishes speaking).
   */
  resumeRemoteAudio(): void;
  stop(): Promise<void>;
}

export function startWebRTCEventHost(options: {
  session: ConversationSession;
  dispatcher?: ToolDispatcher;
  /** Concrete stop/mute for the element playing the remote audio track. */
  muteRemoteAudio: () => void;
  /** Concrete unmute, invoked only from `resumeRemoteAudio()`. */
  unmuteRemoteAudio?: () => void;
  onUserTranscript?: (delta: string) => void;
  onAssistantTranscript?: (delta: string) => void;
  onError?: (error: unknown) => void;
}): WebRTCEventHost {
  const { session } = options;
  const dispatcher = options.dispatcher ?? createToolDispatcher();
  const cancelledCalls = new Set<string>();
  const handledCalls = new Set<string>();
  const inFlightCalls = new Set<string>();
  let stopped = false;
  let cleanup: Promise<void> | null = null;
  let terminalPlaybackStopped = false;
  const stopTerminalPlayback = () => {
    if (terminalPlaybackStopped) return;
    terminalPlaybackStopped = true;
    options.muteRemoteAudio();
  };

  const shutdown = (): Promise<void> => {
    cleanup ??= (async () => {
      stopped = true;
      dispatcher.cancel([...inFlightCalls]);
      stopTerminalPlayback();
      try {
        await session.close();
      } finally {
        // Cleanup is not hostage to a close that failed while the stream
        // stayed open. Playback is MUTED at the end: a terminal provider
        // closure does not prove the element pipeline is silent, and
        // unmuting here could reveal a buffered tail.
        stopTerminalPlayback();
      }
    })();
    return cleanup;
  };

  const pump = (async () => {
    try {
      for await (const event of session.events) {
        if (stopped) continue;
        switch (event.type) {
          case 'interrupted':
            // Provider-side interruption: stale remote audio may still be in
            // the element's pipeline; the host hook silences it.
            options.muteRemoteAudio();
            break;
          case 'userTranscriptDelta':
            options.onUserTranscript?.(event.text);
            break;
          case 'assistantTranscriptDelta':
            options.onAssistantTranscript?.(event.text);
            break;
          case 'toolCall': {
            if (handledCalls.has(event.call.id)) break;
            handledCalls.add(event.call.id);
            inFlightCalls.add(event.call.id);
            void dispatcher.dispatch(event.call)
              .then((result) => {
                inFlightCalls.delete(result.callId);
                if (stopped || cancelledCalls.has(result.callId)) return undefined;
                return session.sendToolResult(result);
              })
              .catch((error) => {
                options.onError?.(error);
                shutdown().catch((failure) => options.onError?.(failure));
              });
            break;
          }
          case 'toolCallsCancelled':
            for (const id of event.ids) cancelledCalls.add(id);
            dispatcher.cancel(event.ids);
            break;
          default:
            break;
        }
      }
    } catch (error) {
      options.onError?.(error);
      await session.close().catch(() => {});
    } finally {
      stopped = true;
      dispatcher.cancel([...inFlightCalls]);
      stopTerminalPlayback();
    }
  })();

  return {
    bargeIn() {
      session.interruptPlayback();
      options.muteRemoteAudio();
    },
    resumeRemoteAudio() {
      // Only an explicit resume during a live conversation unmutes; after
      // shutdown the element stays silenced.
      if (stopped) return;
      options.unmuteRemoteAudio?.();
    },
    stop: () => shutdown(),
  };
}
