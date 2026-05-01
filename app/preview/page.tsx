'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { coreWorkspaces } from '../apps/registry';

// Lightweight version of /demo, used by the landing page iframe.
// Skips boot animation and session restore so the public iframe is stable.
export default function PreviewPage() {
  return (
    <WorkspaceShell
      workspaces={coreWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
      persistSession={false}
    />
  );
}
