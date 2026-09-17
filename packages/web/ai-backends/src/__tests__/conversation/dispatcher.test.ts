import { describe, expect, it } from 'vitest';
import { ToolFailure, createToolDispatcher } from '../../conversation/dispatcher';
import type { ToolCall } from '../../conversation/types';

const call = (id: string, name = 'lookup', args: unknown = { query: 'weather' }): ToolCall => ({
  id,
  name,
  args,
});

describe('conversation tool dispatcher', () => {
  it('preserves call identity on success', async () => {
    const dispatcher = createToolDispatcher();
    dispatcher.register('lookup', async () => ({ answer: 42 }));
    const result = await dispatcher.dispatch({ ...call('c1'), delegationId: 'd1' });
    expect(result).toEqual({
      callId: 'c1',
      name: 'lookup',
      output: { ok: true, value: { answer: 42 } },
      delegationId: 'd1',
    });
  });

  it('fails unknown tools and non-object arguments without running anything', async () => {
    const dispatcher = createToolDispatcher();
    dispatcher.register('lookup', async () => 'never');
    expect((await dispatcher.dispatch(call('c1', 'missing'))).output)
      .toEqual({ ok: false, error: 'Unknown tool.' });
    expect((await dispatcher.dispatch(call('c2', 'lookup', [1, 2]))).output)
      .toEqual({ ok: false, error: 'Tool arguments were not a JSON object.' });
    expect((await dispatcher.dispatch(call('c3', 'lookup', 'not-json-object'))).output)
      .toEqual({ ok: false, error: 'Tool arguments were not a JSON object.' });
  });

  it('runs the declared validator before the handler', async () => {
    let ran = 0;
    const dispatcher = createToolDispatcher();
    dispatcher.register('lookup', async () => { ran += 1; return null; }, {
      validate: (incoming) =>
        (incoming.args as Record<string, unknown>).query ? null : 'The query field is required.',
    });
    const rejected = await dispatcher.dispatch(call('c1', 'lookup', { other: 1 }));
    expect(rejected.output).toEqual({ ok: false, error: 'The query field is required.' });
    expect(ran).toBe(0);
    await dispatcher.dispatch(call('c2'));
    expect(ran).toBe(1);
  });

  it('turns throwing validators and authorizers into correlated safe errors', async () => {
    const dispatcher = createToolDispatcher({
      authorize: async (incoming) => {
        if (incoming.name === 'explode') throw new Error('secret internals');
        return true;
      },
    });
    dispatcher.register('lookup', async () => 'ok', {
      validate: () => {
        throw new Error('validator blew up with secrets');
      },
    });
    dispatcher.register('explode', async () => 'never');
    const validatorFailure = await dispatcher.dispatch(call('c1'));
    expect(validatorFailure.output).toEqual({ ok: false, error: 'Tool argument validation failed.' });
    const authFailure = await dispatcher.dispatch(call('c2', 'explode'));
    expect(authFailure.output).toEqual({ ok: false, error: 'The host declined this tool call.' });
  });

  it('never re-executes a duplicate call ID', async () => {
    let ran = 0;
    const dispatcher = createToolDispatcher();
    dispatcher.register('lookup', async () => { ran += 1; return 'ok'; });
    const first = await dispatcher.dispatch(call('c1'));
    const second = await dispatcher.dispatch(call('c1'));
    expect(first.output).toEqual({ ok: true, value: 'ok' });
    expect(second.output).toEqual({ ok: false, error: 'Duplicate tool call was not executed again.' });
    expect(ran).toBe(1);
  });

  it('cancellation before or during authorization prevents the effect', async () => {
    let ran = 0;
    const auth: { release?: () => void } = {};
    const dispatcher = createToolDispatcher({
      authorize: () => new Promise<boolean>((resolve) => {
        auth.release = () => resolve(true);
      }),
    });
    dispatcher.register('lookup', async () => { ran += 1; return null; });
    dispatcher.cancel(['c0']);
    expect((await dispatcher.dispatch(call('c0'))).output)
      .toEqual({ ok: false, error: 'Tool call was cancelled before it ran.' });
    const pending = dispatcher.dispatch(call('c1'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    dispatcher.cancel(['c1']);
    auth.release?.();
    expect((await pending).output).toEqual({ ok: false, error: 'Tool call was cancelled before it ran.' });
    expect(ran).toBe(0);
  });

  it('discards late results after mid-flight cancellation, keeping the effect', async () => {
    let ran = 0;
    const gate: { release?: () => void } = {};
    const dispatcher = createToolDispatcher();
    dispatcher.register('lookup', async () => {
      ran += 1;
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      return 'late';
    });
    const pending = dispatcher.dispatch(call('c1'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    dispatcher.cancel(['c1']);
    gate.release?.();
    expect((await pending).output)
      .toEqual({ ok: false, error: 'Tool call was cancelled; its late result was discarded.' });
    expect(ran).toBe(1);
  });

  it('lets only deliberate ToolFailure text reach the provider', async () => {
    const dispatcher = createToolDispatcher();
    dispatcher.register('curated', async () => {
      throw new ToolFailure('The city was not found.');
    });
    dispatcher.register('leaky', async () => {
      throw new Error('secret internal path');
    });
    expect((await dispatcher.dispatch(call('c1', 'curated'))).output)
      .toEqual({ ok: false, error: 'The city was not found.' });
    expect((await dispatcher.dispatch(call('c2', 'leaky'))).output)
      .toEqual({ ok: false, error: 'The tool failed.' });
  });
});
