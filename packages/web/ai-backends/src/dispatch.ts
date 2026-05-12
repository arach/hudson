// ---------------------------------------------------------------------------
// Default dispatch() implementation — aggregates stream() to DispatchResult
// ---------------------------------------------------------------------------

import type { Backend, DispatchRequest, DispatchResult, StreamEvent } from './types';

/**
 * Consume a Backend's stream() to completion and aggregate into a DispatchResult.
 * Used as the default `dispatch()` when a backend doesn't provide its own.
 */
export async function aggregateStream<Cfg, TMeta>(
  backend: Backend<Cfg, TMeta>,
  req: DispatchRequest<Cfg>,
): Promise<DispatchResult<TMeta>> {
  const chunks: string[] = [];
  const toolCalls: DispatchResult<TMeta>['toolCalls'] = [];
  let usage: DispatchResult<TMeta>['usage'];
  let sessionRef: string | undefined;
  let meta: TMeta | undefined;

  for await (const event of backend.stream(req)) {
    if (req.signal?.aborted) break;

    switch (event.type) {
      case 'text':
        chunks.push(event.delta);
        break;
      case 'tool_call':
        toolCalls.push({ id: event.id, name: event.name, input: event.input });
        break;
      case 'tool_result': {
        const tc = toolCalls.find((t) => t.id === event.id);
        if (tc) tc.output = event.output;
        break;
      }
      case 'usage':
        usage = { input: event.input, output: event.output, cost: event.cost };
        break;
      case 'session':
        sessionRef = event.sessionRef;
        break;
      case 'done':
        meta = event.meta;
        break;
      case 'error':
        if (!event.recoverable) {
          throw new Error(event.message);
        }
        break;
    }
  }

  return {
    reply: chunks.join(''),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage,
    sessionRef,
    meta,
  };
}
