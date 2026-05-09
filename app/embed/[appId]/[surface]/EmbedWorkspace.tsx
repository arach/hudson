'use client';

import { Suspense } from 'react';
import { WorkspaceShell, type WorkspaceShellInitialState } from '../../../shell/WorkspaceShell';
import { coreWorkspaces } from '../../../apps/registry';

export function EmbedWorkspace({ initialState }: { initialState: WorkspaceShellInitialState }) {
  return (
    <Suspense fallback={null}>
      <WorkspaceShell
        workspaces={coreWorkspaces}
        defaultWorkspaceId={initialState.activeWorkspaceId}
        bootMode="none"
        persistSession={false}
        initialState={initialState}
      />
    </Suspense>
  );
}
