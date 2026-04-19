'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { allWorkspaces } from '../workspaces';

// Lightweight version of /demo, used by the landing page iframe.
// Skips the boot animation so visitors see the workspace immediately.
export default function PreviewPage() {
  return (
    <WorkspaceShell
      workspaces={allWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
    />
  );
}
