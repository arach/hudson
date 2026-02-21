import { NextRequest, NextResponse } from 'next/server';
import { buildIntentCatalog } from '../../lib/intent-catalog';
import { hudsonOSWorkspace, shaperDevWorkspace } from '../../workspaces';

const workspaceMap: Record<string, typeof hudsonOSWorkspace> = {
  'hudson-os': hudsonOSWorkspace,
  'shaper-dev': shaperDevWorkspace,
};

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace') ?? 'hudson-os';
  const workspace = workspaceMap[workspaceId];

  if (!workspace) {
    return NextResponse.json(
      { error: `Unknown workspace: ${workspaceId}` },
      { status: 404 },
    );
  }

  const catalog = buildIntentCatalog(workspace);
  return NextResponse.json(catalog);
}
