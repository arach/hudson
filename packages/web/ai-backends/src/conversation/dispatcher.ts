import type { ToolCall, ToolResult } from './types';

// ---------------------------------------------------------------------------
// Local asynchronous tool execution owned by the host. Provider messages are
// data: the dispatcher looks up host-registered handlers by name and never
// evaluates provider-supplied code. Effects run at most once per call ID.
// ---------------------------------------------------------------------------

/**
 * A failure a tool handler deliberately shows to the provider. Any other
 * thrown error is replaced with generic text so host internals and secrets
 * cannot leak into provider context.
 */
export class ToolFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolFailure';
  }
}

export type ToolHandler = (call: ToolCall) => Promise<unknown>;
/** Return a rejection message, or null to accept. Runs before authorization. */
export type ToolValidator = (call: ToolCall) => Promise<string | null> | string | null;
export type ToolAuthorizer = (call: ToolCall) => Promise<boolean> | boolean;

export interface ToolDispatcher {
  register(name: string, handler: ToolHandler, options?: { validate?: ToolValidator }): void;
  /**
   * Cancel provider-withdrawn calls. A handler that has already produced an
   * effect keeps its effect; only its result delivery is suppressed.
   */
  cancel(ids: string[]): void;
  /**
   * Execute one provider tool call and return the result to send back.
   * Duplicate call IDs return an error without re-running the effect.
   */
  dispatch(call: ToolCall): Promise<ToolResult>;
}

export function createToolDispatcher(options: { authorize?: ToolAuthorizer } = {}): ToolDispatcher {
  const authorize = options.authorize ?? (() => true);
  const registrations = new Map<string, { handler: ToolHandler; validate?: ToolValidator }>();
  const started = new Set<string>();
  const cancelled = new Set<string>();

  const failure = (call: ToolCall, error: string): ToolResult => ({
    callId: call.id,
    name: call.name,
    output: { ok: false, error },
    delegationId: call.delegationId,
  });

  return {
    register(name, handler, registerOptions) {
      registrations.set(name, { handler, validate: registerOptions?.validate });
    },
    cancel(ids) {
      for (const id of ids) cancelled.add(id);
    },
    async dispatch(call) {
      if (started.has(call.id)) return failure(call, 'Duplicate tool call was not executed again.');
      started.add(call.id);
      if (cancelled.has(call.id)) return failure(call, 'Tool call was cancelled before it ran.');
      const registration = registrations.get(call.name);
      if (!registration) return failure(call, 'Unknown tool.');
      if (typeof call.args !== 'object' || call.args === null || Array.isArray(call.args)) {
        return failure(call, 'Tool arguments were not a JSON object.');
      }
      // Validators and authorizers are host callbacks that may throw or
      // reject; their failures become correlated generic errors instead of
      // leaking or escaping as unhandled rejections.
      if (registration.validate) {
        let rejection: string | null;
        try {
          rejection = await registration.validate(call);
        } catch {
          return failure(call, 'Tool argument validation failed.');
        }
        if (rejection) return failure(call, rejection);
      }
      let authorized: boolean;
      try {
        authorized = await authorize(call);
      } catch {
        authorized = false;
      }
      if (!authorized) return failure(call, 'The host declined this tool call.');
      // Cancellation can arrive while validation or authorization awaited;
      // the effect must not start afterwards.
      if (cancelled.has(call.id)) return failure(call, 'Tool call was cancelled before it ran.');

      let output: ToolResult['output'];
      try {
        output = { ok: true, value: await registration.handler(call) };
      } catch (error) {
        output = {
          ok: false,
          error: error instanceof ToolFailure ? error.message : 'The tool failed.',
        };
      }
      if (cancelled.has(call.id)) {
        return failure(call, 'Tool call was cancelled; its late result was discarded.');
      }
      return { callId: call.id, name: call.name, output, delegationId: call.delegationId };
    },
  };
}
