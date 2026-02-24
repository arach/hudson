'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { hudsonOSWorkspace, shaperDevWorkspace } from '../workspaces';

export default function AppPage() {
  return (
    <WorkspaceShell
      workspaces={[hudsonOSWorkspace, shaperDevWorkspace]}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
    />
  );
}
