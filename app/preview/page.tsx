'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { getHudsonKitWorkspace } from '../apps/registry';

const previewWorkspaces = [getHudsonKitWorkspace()];

// Lightweight version of /demo, used by the landing page iframe.
// Skips boot animation and session restore so the public iframe is stable.
export default function PreviewPage() {
  return (
    <WorkspaceShell
      workspaces={previewWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
      persistSession={false}
    />
  );
}
