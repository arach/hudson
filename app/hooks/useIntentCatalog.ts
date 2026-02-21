'use client';

import { useMemo } from 'react';
import type { HudsonWorkspace, IntentCatalog } from 'frame-ui';
import { buildIntentCatalog } from '../lib/intent-catalog';

/**
 * Memoized intent catalog for a workspace.
 * Recomputes only when the workspace reference changes.
 */
export function useIntentCatalog(workspace: HudsonWorkspace): IntentCatalog {
  return useMemo(() => buildIntentCatalog(workspace), [workspace]);
}
