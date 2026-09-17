import { ConversationError, type ConversationEvent } from './types';

// ---------------------------------------------------------------------------
// Bounded event delivery shared by provider clients. Audio chunks may be
// evicted under backpressure (stale speech), but losing a control event —
// tool calls, interruptions, terminal events — is a session failure, never a
// silent drop.
// ---------------------------------------------------------------------------

export class EventChannel {
  private queue: ConversationEvent[] = [];
  private waiters: Array<(result: IteratorResult<ConversationEvent>) => void> = [];
  private failures: Array<(error: Error) => void> = [];
  private done = false;
  private failure: Error | null = null;

  constructor(private readonly capacity = 512) {}

  /**
   * Returns false when a control event could not be delivered; the caller
   * must fail the session with an `event-overflow` error.
   */
  push(event: ConversationEvent): boolean {
    if (this.done) return event.type === 'assistantAudio';
    const waiter = this.waiters.shift();
    if (waiter) {
      this.failures.shift();
      waiter({ value: event, done: false });
      return true;
    }
    this.queue.push(event);
    if (this.queue.length > this.capacity) {
      const audioIndex = this.queue.findIndex((queued) => queued.type === 'assistantAudio');
      if (audioIndex >= 0) {
        this.queue.splice(audioIndex, 1);
        return true;
      }
      this.queue.shift();
      return false;
    }
    return true;
  }

  finish(error?: Error): void {
    if (this.done) return;
    this.done = true;
    this.failure = error ?? null;
    if (error) {
      for (const fail of this.failures) fail(error);
    } else {
      for (const waiter of this.waiters) waiter({ value: undefined, done: true });
    }
    this.waiters = [];
    this.failures = [];
  }

  get events(): AsyncIterable<ConversationEvent> {
    const next = (): Promise<IteratorResult<ConversationEvent>> => {
      const queued = this.queue.shift();
      if (queued !== undefined) return Promise.resolve({ value: queued, done: false });
      if (this.done) {
        if (this.failure) return Promise.reject(this.failure);
        return Promise.resolve({ value: undefined, done: true });
      }
      return new Promise((resolve, reject) => {
        this.waiters.push(resolve);
        this.failures.push(reject);
      });
    };
    return {
      [Symbol.asyncIterator]: () => ({ next }),
    };
  }
}

export function overflowError(): ConversationError {
  return new ConversationError(
    'event-overflow',
    'The host stopped consuming events and a control event would have been lost.',
  );
}
