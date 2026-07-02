import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineApp } from '../src/lib/defineApp';
import type { CommandOption } from '../src/components/overlays/CommandPalette';
import type { HudsonApp } from '../src/types/app';

afterEach(() => {
  cleanup();
});

function Content() {
  return <div data-testid="content">content</div>;
}

/** Render a probe inside the app's Provider and capture hook results the way
 *  the shell's Bridge component does. */
function harvestHooks(app: HudsonApp, providerProps: { disabled?: boolean; visible?: boolean } = {}) {
  const captured: { commands: CommandOption[]; status: ReturnType<HudsonApp['hooks']['useStatus']> } = {
    commands: [],
    status: { label: '', color: 'neutral' },
  };
  function Probe() {
    captured.commands = app.hooks.useCommands();
    captured.status = app.hooks.useStatus();
    return null;
  }
  const view = render(
    <app.Provider {...providerProps}>
      <Probe />
      <app.slots.Content />
    </app.Provider>,
  );
  return { captured, view };
}

describe('defineApp', () => {
  it('produces a valid HudsonApp with defaults applied', () => {
    const app = defineApp({
      id: 'minimal',
      name: 'Minimal',
      slots: { Content },
    });

    // Assignable to the contract and defaults filled in.
    const contract: HudsonApp = app;
    expect(contract.id).toBe('minimal');
    expect(app.name).toBe('Minimal');
    expect(app.mode).toBe('panel');
    expect(typeof app.Provider).toBe('function');
    expect(typeof app.hooks.useCommands).toBe('function');
    expect(typeof app.hooks.useStatus).toBe('function');

    const { captured } = harvestHooks(app);
    expect(captured.commands).toEqual([]);
    expect(captured.status).toEqual({ label: 'READY', color: 'emerald' });
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('passes through explicit fields and custom status', () => {
    const app = defineApp({
      id: 'custom',
      name: 'Custom',
      description: 'A custom app',
      mode: 'canvas',
      multiInstance: 'spawnable',
      status: { label: 'IDLE', color: 'amber' },
      slots: { Content },
    });

    expect(app.mode).toBe('canvas');
    expect(app.description).toBe('A custom app');
    expect(app.multiInstance).toBe('spawnable');
    const { captured } = harvestHooks(app);
    expect(captured.status).toEqual({ label: 'IDLE', color: 'amber' });
  });

  it('resolves declared command actions from useCommandActions and inline action', () => {
    const fromProvider = vi.fn();
    const inline = vi.fn();

    const CounterContext = createContext<(() => void) | null>(null);
    function CounterProvider({ children }: { children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }) {
      return <CounterContext.Provider value={fromProvider}>{children}</CounterContext.Provider>;
    }

    const app = defineApp({
      id: 'counter',
      name: 'Counter',
      Provider: CounterProvider,
      slots: { Content },
      commands: [
        { id: 'counter:increment', label: 'Increment' },
        { id: 'counter:reset', label: 'Reset', action: inline },
      ],
      hooks: {
        useCommandActions: () => {
          const increment = useContext(CounterContext);
          return useMemo(() => ({ 'counter:increment': increment ?? undefined }), [increment]);
        },
      },
      intents: [
        {
          commandId: 'counter:increment',
          title: 'Increment the counter',
          description: 'Adds one to the count',
          category: 'tool',
          keywords: ['add'],
        },
      ],
    });

    expect(app.intents).toHaveLength(1);
    expect(app.intents?.[0].commandId).toBe('counter:increment');

    const { captured } = harvestHooks(app);
    expect(captured.commands.map((c) => c.id)).toEqual(['counter:increment', 'counter:reset']);

    captured.commands[0].action();
    expect(fromProvider).toHaveBeenCalledTimes(1);
    captured.commands[1].action();
    expect(inline).toHaveBeenCalledTimes(1);
  });

  it('appends dynamic commands from hooks.useCommands after declared commands', () => {
    const dynamicAction = vi.fn();
    const app = defineApp({
      id: 'mixed',
      name: 'Mixed',
      slots: { Content },
      commands: [{ id: 'mixed:static', label: 'Static', action: vi.fn() }],
      hooks: {
        useCommands: () =>
          useMemo(() => [{ id: 'mixed:dynamic', label: 'Dynamic', action: dynamicAction }], []),
      },
    });

    const { captured } = harvestHooks(app);
    expect(captured.commands.map((c) => c.id)).toEqual(['mixed:static', 'mixed:dynamic']);
    captured.commands[1].action();
    expect(dynamicAction).toHaveBeenCalledTimes(1);
  });

  it('derives a manifest from declared commands when none is provided', () => {
    const app = defineApp({
      id: 'manifested',
      name: 'Manifested',
      slots: { Content },
      commands: [{ id: 'manifested:go', label: 'Go', shortcut: 'Cmd+G', action: vi.fn() }],
    });

    expect(app.manifest).toEqual({
      id: 'manifested',
      name: 'Manifested',
      description: undefined,
      mode: 'panel',
      commands: [{ id: 'manifested:go', label: 'Go', shortcut: 'Cmd+G' }],
      tools: undefined,
    });
  });

  it('wraps the Provider to wire declared shortcuts (and still renders the base Provider)', () => {
    const action = vi.fn();
    const providerRendered = vi.fn();

    function TracksProvider({ children }: { children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }) {
      providerRendered();
      return <div data-testid="base-provider">{children}</div>;
    }

    const app = defineApp({
      id: 'shortcutted',
      name: 'Shortcutted',
      Provider: TracksProvider,
      slots: { Content },
      commands: [{ id: 'shortcutted:go', label: 'Go', shortcut: 'Cmd+G', action }],
    });

    harvestHooks(app);
    expect(providerRendered).toHaveBeenCalled();
    expect(screen.getByTestId('base-provider')).toBeInTheDocument();

    // jsdom is a non-Apple platform, so Cmd resolves to Ctrl.
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not fire shortcuts when the Provider is disabled or hidden', () => {
    const action = vi.fn();
    const app = defineApp({
      id: 'gated',
      name: 'Gated',
      slots: { Content },
      commands: [{ id: 'gated:go', label: 'Go', shortcut: 'Cmd+G', action }],
    });

    const { view } = harvestHooks(app, { disabled: true });
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(action).not.toHaveBeenCalled();
    view.unmount();

    harvestHooks(app, { visible: false });
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it('opts out of shortcut wiring with autoShortcuts: false', () => {
    const action = vi.fn();
    const app = defineApp({
      id: 'optout',
      name: 'Opt Out',
      slots: { Content },
      autoShortcuts: false,
      commands: [{ id: 'optout:go', label: 'Go', shortcut: 'Cmd+G', action }],
    });

    harvestHooks(app);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it('constrains intent commandIds to declared command ids (compile-time) and warns at runtime in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      defineApp({
        id: 'typed',
        name: 'Typed',
        slots: { Content },
        commands: [{ id: 'typed:only', label: 'Only', action: () => {} }],
        intents: [
          {
            // @ts-expect-error — 'typed:missing' is not a declared command id
            commandId: 'typed:missing',
            title: 'Bad intent',
            description: 'Should not typecheck',
            category: 'tool',
            keywords: [],
          },
        ],
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('typed:missing'));
    } finally {
      warn.mockRestore();
    }
  });
});
