'use client';

import { Suspense } from 'react';
import { WorkspaceShell } from '../../../shell/WorkspaceShell';
import { coreWorkspaces } from '../../../apps/registry';

export function EmbedWorkspace() {
  return (
    <Suspense fallback={null}>
      <WorkspaceShell
        workspaces={coreWorkspaces}
        defaultWorkspaceId="hudson-os"
        bootMode="none"
        persistSession={false}
      />
    </Suspense>
  );
}
