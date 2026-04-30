'use client';

import { use } from 'react';
import Link from 'next/link';
import { WorkspaceShell } from '../../shell/WorkspaceShell';
import { getAllWorkspaces } from '../../apps/registry';
import type { HudsonWorkspace } from 'hudsonkit';

export default function SingleAppPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);

  // Find the app across all workspaces
  const allWorkspaces = getAllWorkspaces();
  let foundConfig = null;
  for (const ws of allWorkspaces) {
    const match = ws.apps.find((c) => c.app.id === appId);
    if (match) {
      foundConfig = match;
      break;
    }
  }

  if (!foundConfig) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, color: '#999', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ fontSize: 18 }}>App &ldquo;{appId}&rdquo; not found</p>
        <Link href="/app" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
          Back to HudsonKit
        </Link>
      </div>
    );
  }

  const singleWorkspace: HudsonWorkspace = {
    id: appId,
    name: foundConfig.app.name,
    mode: foundConfig.app.mode,
    apps: [foundConfig],
  };

  return (
    <WorkspaceShell
      workspaces={[singleWorkspace]}
      defaultWorkspaceId={appId}
      bootMode="none"
    />
  );
}
