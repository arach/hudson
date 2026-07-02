'use client';

import type { ReactNode } from 'react';

/** The stage-design app is a thin shell over the workspace decor context.
 *  All state lives in WorkspaceDecorProvider (mounted by WorkspaceShell), so
 *  this Provider just passes children through — it exists only to satisfy the
 *  HudsonApp contract. */
export function StageDesignProvider({ children }: { children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }) {
  return <>{children}</>;
}
