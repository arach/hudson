'use client';

import { WorkspaceShell } from './shell/WorkspaceShell';
import { hudsonOSWorkspace, shaperDevWorkspace } from './workspaces';

export default function Page() {
  return (
    <WorkspaceShell
      workspaces={[hudsonOSWorkspace, shaperDevWorkspace]}
      defaultWorkspaceId="hudson-os"
    />
  );
}
