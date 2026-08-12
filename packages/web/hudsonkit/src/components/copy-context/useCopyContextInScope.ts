'use client';

import React from 'react';
import { Copy } from '../../icons';
import type { ContextMenuAction } from '../overlays/ContextMenu';
import { agentCopy, type AgentCopyOptions } from '../../lib/agentCopy';
import { useCopyContextScope } from './CopyContextScope';

/**
 * Returns a `ContextMenuAction` ready to spread into `HudsonContextMenu`'s
 * items array. Walks the nearest `<CopyContextScope>` when invoked.
 */
export function useCopyContextInScope(options?: AgentCopyOptions): ContextMenuAction {
  const scope = useCopyContextScope();
  return {
    id: 'hudson.copy_context',
    label: 'Copy for agent',
    icon: React.createElement(Copy, { size: 12 }),
    shortcut: '⌘⇧.',
    disabled: !scope,
    action: () => {
      if (!scope) return;
      const node = scope.getNode();
      const text = scope.getSource
        ? scope.getSource()
        : node
          ? agentCopy(node, options)
          : '';
      if (text) void navigator.clipboard.writeText(text);
    },
  };
}
