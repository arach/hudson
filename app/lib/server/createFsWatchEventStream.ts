import { watch, type FSWatcher } from 'fs';

interface CreateFsWatchEventStreamOptions {
  request: Request;
  watchPaths: string[];
  ensure?: () => Promise<void>;
  debounceMs?: number;
  pingMs?: number;
}

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

function encodeSse(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function createFsWatchEventStream({
  request,
  watchPaths,
  ensure,
  debounceMs = 120,
  pingMs = 25_000,
}: CreateFsWatchEventStreamOptions) {
  await ensure?.();

  const encoder = new TextEncoder();
  let closeStream = () => {};

  return new Response(new ReadableStream({
    start(controller) {
      const watchers: FSWatcher[] = [];
      let closed = false;
      let debounceId: ReturnType<typeof setTimeout> | null = null;

      const enqueue = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (debounceId) clearTimeout(debounceId);
        watchers.forEach((watcher) => watcher.close());
        clearInterval(pingId);
        request.signal.removeEventListener('abort', close);
        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      };
      closeStream = close;

      const scheduleInvalidate = () => {
        if (closed) return;
        if (debounceId) clearTimeout(debounceId);
        debounceId = setTimeout(() => {
          debounceId = null;
          enqueue(encodeSse('invalidate', { ts: Date.now() }));
        }, debounceMs);
      };

      for (const watchPath of watchPaths) {
        try {
          watchers.push(watch(watchPath, { persistent: false }, scheduleInvalidate));
        } catch (error) {
          enqueue(encodeSse('warning', {
            path: watchPath,
            message: error instanceof Error ? error.message : String(error),
          }));
        }
      }

      enqueue(`: connected ${Date.now()}\n\n`);
      const pingId = setInterval(() => {
        enqueue(`: ping ${Date.now()}\n\n`);
      }, pingMs);

      request.signal.addEventListener('abort', close, { once: true });
    },
    cancel() {
      closeStream();
    },
  }), {
    headers: STREAM_HEADERS,
  });
}
