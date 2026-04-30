'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { allWorkspaces } from '../workspaces';

export default function AppPage() {
  return (
    <WorkspaceShell
      workspaces={allWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
    />
  );
}
