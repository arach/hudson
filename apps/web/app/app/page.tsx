'use client';

import { WorkspaceShell } from 'hudsonkit/workspace';
import { allWorkspaces } from '../workspaces';
import { hudsonShellEnvironment } from '../lib/hudsonShellEnvironment';

export default function AppPage() {
  return (
    <WorkspaceShell
      workspaces={allWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
      sideNavMode="anchored"
      environment={hudsonShellEnvironment}
    />
  );
}
