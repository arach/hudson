'use client';

import { Suspense } from 'react';
import { ThemeProvider } from 'hudsonkit';
import { WorkspaceShell, type WorkspaceShellInitialState } from '../../../shell/WorkspaceShell';
import { coreWorkspaces } from '../../../apps/registry';

export function EmbedWorkspace({ initialState }: { initialState: WorkspaceShellInitialState }) {
  return (
    <ThemeProvider
      defaultTheme={initialState.theme}
      defaultTemplate={initialState.template}
    >
      <Suspense fallback={null}>
        <WorkspaceShell
          workspaces={coreWorkspaces}
          defaultWorkspaceId={initialState.activeWorkspaceId}
          bootMode="none"
          persistSession={false}
          initialState={initialState}
        />
      </Suspense>
    </ThemeProvider>
  );
}
