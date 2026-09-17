import type { ConversationEvent, ConversationSession, WireSocket } from '../../conversation/types';

// ---------------------------------------------------------------------------
// Scripted socket: tests push server messages and inspect parsed client
// sends. No network is involved anywhere in this suite.
// ---------------------------------------------------------------------------

export class FakeSocket implements WireSocket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  private listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(type: string, event: { data?: unknown } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  push(json: Record<string, unknown>): void {
    this.emit('message', { data: JSON.stringify(json) });
  }

  sentTypes(): string[] {
    return this.sent.map((message) => String(message.type ?? Object.keys(message)[0]));
  }
}

export function eventReader(session: ConversationSession) {
  const iterator = session.events[Symbol.asyncIterator]();
  return {
    async next(): Promise<ConversationEvent> {
      const result = await iterator.next();
      if (result.done) throw new Error('The event stream ended early.');
      return result.value;
    },
    async ended(): Promise<boolean> {
      const result = await iterator.next();
      return result.done === true;
    },
    async failure(): Promise<unknown> {
      try {
        await iterator.next();
        return null;
      } catch (error) {
        return error;
      }
    },
  };
}

export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
