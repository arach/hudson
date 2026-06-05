'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { allWorkspaces } from '../workspaces';
import { hudsonShellEnvironment } from '../lib/hudsonShellEnvironment';

export default function AppPage() {
  return (
    <WorkspaceShell
      workspaces={allWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
      environment={hudsonShellEnvironment}
    />
  );
}
