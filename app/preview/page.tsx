'use client';

import { WorkspaceShell } from '../shell/WorkspaceShell';
import { allWorkspaces } from '../apps/registry';

// Lightweight version of /app, used by the landing page iframe.
// Skips boot animation and session restore so the public iframe is stable
// while still showing the same public workspace shape as the full app.
export default function PreviewPage() {
  return (
    <WorkspaceShell
      workspaces={allWorkspaces}
      defaultWorkspaceId="hudson-os"
      bootMode="none"
      persistSession={false}
      workspaceNavigation="rail"
    />
  );
}
