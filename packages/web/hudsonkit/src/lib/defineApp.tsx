'use client';

import { useMemo, type FC, type ReactNode } from 'react';
import type { CommandOption } from '../components/overlays/CommandPalette';
import type { AppIntent } from '../types/intent';
import type { HudsonApp, StatusState } from '../types/app';
import { useCommandShortcuts } from '../hooks/useCommandShortcuts';

// ---------------------------------------------------------------------------
// defineApp — typed factory for the HudsonApp contract.
//
// Every app used to hand-assemble the same `{ id, name, mode, Provider,
// slots, hooks }` literal, and `AppIntent.commandId` had to string-match a
// `CommandOption.id` from `useCommands()` with zero enforcement. This factory
// keeps the exact same runtime contract (the return value is a plain
// `HudsonApp`; hand-built literals keep working untouched) while adding:
//
//   - defaults for the mechanical parts: `mode: 'panel'`, a passthrough
//     Provider, an empty `useCommands`, and a static READY `useStatus`;
//   - const-typed command ids: declare `commands` (and/or a `hooks.useCommands`
//     whose ids are literal) and every `intents[].commandId` is constrained at
//     compile time to that id union — a typo is a type error;
//   - optional automatic shortcut wiring: when declared commands carry a
//     `shortcut`, the Provider is wrapped so `useCommandShortcuts` makes those
//     chords real (opt out with `autoShortcuts: false`, or force on with
//     `autoShortcuts: true` when your shortcuts come from `hooks.useCommands`).
// ---------------------------------------------------------------------------

const EMPTY_COMMANDS: CommandOption[] = [];
const READY_STATUS: StatusState = { label: 'READY', color: 'emerald' };

function PassthroughProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** A statically declared command. Same shape as `CommandOption` except the id
 *  is const-typed and the action is optional — provide it inline for
 *  state-free commands, or resolve it from Provider state via
 *  `hooks.useCommandActions`. */
export type AppCommandDeclaration<TCommandId extends string = string> = Omit<
  CommandOption,
  'id' | 'action'
> & {
  id: TCommandId;
  /** Static action for commands that don't need Provider state. */
  action?: () => void;
};

/** A `CommandOption` whose id participates in the app's command-id union. */
export type AppCommandOption<TCommandId extends string = string> = Omit<CommandOption, 'id'> & {
  id: TCommandId;
};

/** An `AppIntent` whose `commandId` is constrained to the declared command ids. */
export type AppIntentDeclaration<TCommandId extends string = string> = Omit<
  AppIntent,
  'commandId'
> & {
  commandId: TCommandId;
};

/** Map from declared command id to the action resolved inside Provider scope.
 *  Partial so commands with a static `action` can be omitted. */
export type CommandActionMap<TCommandId extends string = string> = Partial<
  Record<TCommandId, () => void>
>;

export type DefineAppHooks<TCommandId extends string = string> = Omit<
  HudsonApp['hooks'],
  'useCommands' | 'useStatus'
> & {
  /** Extra dynamic commands, appended after the declared `commands`. When the
   *  returned ids are literal they widen the command-id union for intents. */
  useCommands?: () => ReadonlyArray<AppCommandOption<TCommandId>>;
  /** Optional — defaults to a static READY status (see `status`). */
  useStatus?: () => StatusState;
  /** Resolves actions for declared `commands` from Provider state. Called
   *  inside Provider scope like every other app hook. */
  useCommandActions?: () => CommandActionMap<NoInfer<TCommandId>>;
};

export interface DefineAppConfig<TCommandId extends string = string>
  extends Partial<Omit<HudsonApp, 'id' | 'name' | 'mode' | 'Provider' | 'slots' | 'hooks' | 'intents'>> {
  /** Unique identifier (used as key + localStorage namespace). */
  id: string;
  /** Human-readable name shown in the app switcher. */
  name: string;
  /** Defaults to 'panel'. */
  mode?: HudsonApp['mode'];
  /** Defaults to a passthrough Provider (no app-owned state). */
  Provider?: HudsonApp['Provider'];
  slots: HudsonApp['slots'];
  /** Statically declared commands — the source of the const-typed command-id
   *  union. Actions come from the inline `action` or `hooks.useCommandActions`. */
  commands?: ReadonlyArray<AppCommandDeclaration<TCommandId>>;
  /** Intent declarations whose `commandId` must be one of the declared ids. */
  intents?: ReadonlyArray<AppIntentDeclaration<NoInfer<TCommandId>>>;
  /** All hooks are optional; `useCommands`/`useStatus` get defaults. */
  hooks?: DefineAppHooks<TCommandId>;
  /** Static status used when `hooks.useStatus` is absent. Defaults to READY. */
  status?: StatusState;
  /** Automatic shortcut wiring via `useCommandShortcuts`.
   *  Default: enabled when any declared command has a `shortcut`.
   *  Set `false` to opt out (shortcuts stay display-only), or `true` to wire
   *  even when shortcuts only come from `hooks.useCommands`. */
  autoShortcuts?: boolean;
}

function warnMissingAction(appId: string, commandId: string): () => void {
  return () => {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[hudsonkit] defineApp(${appId}): command "${commandId}" has no action — ` +
          'provide `action` on the declaration or map it in `hooks.useCommandActions`.',
      );
    }
  };
}

/**
 * Build a `HudsonApp` from a declarative config.
 *
 * @example
 * export const counterApp = defineApp({
 *   id: 'counter',
 *   name: 'Counter',
 *   Provider: CounterProvider,
 *   slots: { Content: CounterContent },
 *   commands: [
 *     { id: 'counter:increment', label: 'Increment', shortcut: 'Cmd+I' },
 *     { id: 'counter:reset', label: 'Reset' },
 *   ],
 *   hooks: {
 *     useCommandActions: () => {
 *       const { increment, reset } = useCounter();
 *       return { 'counter:increment': increment, 'counter:reset': reset };
 *     },
 *   },
 *   intents: [
 *     {
 *       commandId: 'counter:increment', // typo here = compile error
 *       title: 'Increment the counter',
 *       description: 'Adds one to the current count',
 *       category: 'tool',
 *       keywords: ['add', 'plus'],
 *     },
 *   ],
 * });
 */
export function defineApp<const TCommandId extends string = string>(
  config: DefineAppConfig<TCommandId>,
): HudsonApp {
  const { commands, intents, hooks, status, autoShortcuts, mode, Provider, ...rest } = config;

  const declared = commands ?? [];
  const {
    useCommands: userUseCommands,
    useStatus: userUseStatus,
    useCommandActions,
    ...otherHooks
  } = hooks ?? {};

  // Dev-only sanity check for plain-JS consumers (TS already enforces this).
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production' &&
    intents &&
    declared.length > 0 &&
    !userUseCommands
  ) {
    const knownIds = new Set<string>(declared.map((command) => command.id));
    for (const intent of intents) {
      if (!knownIds.has(intent.commandId)) {
        console.warn(
          `[hudsonkit] defineApp(${config.id}): intent "${intent.title}" targets ` +
            `commandId "${intent.commandId}" which is not a declared command id.`,
        );
      }
    }
  }

  // --- Commands hook ---------------------------------------------------
  // Declared commands (actions resolved via useCommandActions / inline
  // `action`) followed by any dynamic commands from hooks.useCommands.
  // Both optional sub-hooks are normalized to unconditional hook calls so
  // the synthesized hook is stable across renders.
  const useActionMap: () => CommandActionMap<TCommandId> | undefined =
    useCommandActions ?? (() => undefined);
  const useExtraCommands: () => ReadonlyArray<AppCommandOption<TCommandId>> | undefined =
    userUseCommands ?? (() => undefined);

  function useDefinedCommands(): CommandOption[] {
    const actionMap = useActionMap();
    const extra = useExtraCommands();
    return useMemo(() => {
      if (declared.length === 0 && !extra) return EMPTY_COMMANDS;
      const resolved: CommandOption[] = declared.map((command) => ({
        ...command,
        action:
          actionMap?.[command.id] ?? command.action ?? warnMissingAction(config.id, command.id),
      }));
      return extra ? [...resolved, ...extra] : resolved;
    }, [actionMap, extra]);
  }

  // --- Status hook -------------------------------------------------------
  const staticStatus = status ?? READY_STATUS;
  const useDefinedStatus = userUseStatus ?? (() => staticStatus);

  // --- Provider (+ optional shortcut wiring) ------------------------------
  const BaseProvider = Provider ?? PassthroughProvider;
  const declaredHasShortcut = declared.some((command) => Boolean(command.shortcut));
  const wireShortcuts = autoShortcuts === true || (autoShortcuts !== false && declaredHasShortcut);

  let FinalProvider: HudsonApp['Provider'] = BaseProvider;
  if (wireShortcuts) {
    const ShortcutBridge: FC<{ active: boolean }> = ({ active }) => {
      const commandList = useDefinedCommands();
      useCommandShortcuts(commandList, { enabled: active });
      return null;
    };
    ShortcutBridge.displayName = `DefineAppShortcutBridge(${config.id})`;

    const WrappedProvider: HudsonApp['Provider'] = ({ children, disabled, visible, focused }) => (
      <BaseProvider disabled={disabled} visible={visible} focused={focused}>
        <ShortcutBridge active={disabled !== true && visible !== false} />
        {children}
      </BaseProvider>
    );
    WrappedProvider.displayName = `DefineAppProvider(${config.id})`;
    FinalProvider = WrappedProvider;
  }

  // --- Manifest ------------------------------------------------------------
  // When commands are declared statically we can enrich the auto-derived
  // manifest with them (an explicit config.manifest always wins).
  const manifest =
    rest.manifest ??
    (declared.length > 0
      ? {
          id: config.id,
          name: config.name,
          description: rest.description,
          mode: mode ?? 'panel',
          commands: declared.map(({ id, label, shortcut }) => ({ id, label, shortcut })),
          tools: rest.tools?.map((tool) => ({ id: tool.id, name: tool.name })),
        }
      : undefined);

  return {
    ...rest,
    mode: mode ?? 'panel',
    Provider: FinalProvider,
    ...(intents ? { intents: [...intents] } : {}),
    ...(manifest ? { manifest } : {}),
    hooks: {
      ...otherHooks,
      useCommands: useDefinedCommands,
      useStatus: useDefinedStatus,
    },
  };
}
