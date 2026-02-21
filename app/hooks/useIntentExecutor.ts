'use client';

import { useCallback, useEffect } from 'react';
import type { CommandOption, IntentCatalog } from 'frame-ui';

/**
 * Bridges static intents to live command closures.
 * Returns an execute function that finds a command by ID and fires its action.
 */
export function useIntentExecutor(
  allCommands: CommandOption[],
  catalog: IntentCatalog,
) {
  // Dev-mode: warn when an intent commandId has no matching live command
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const liveIds = new Set(allCommands.map(c => c.id));
    for (const [commandId] of Object.entries(catalog.index)) {
      if (!liveIds.has(commandId)) {
        console.warn(`[IntentExecutor] intent "${commandId}" has no matching live command`);
      }
    }
  }, [allCommands, catalog]);

  const execute = useCallback(
    (commandId: string): boolean => {
      const cmd = allCommands.find(c => c.id === commandId);
      if (!cmd) return false;
      cmd.action();
      return true;
    },
    [allCommands],
  );

  return { execute };
}
