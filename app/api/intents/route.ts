import { NextRequest, NextResponse } from 'next/server';
import { buildIntentCatalog } from '../../lib/intent-catalog';
import { allWorkspaces } from '../../workspaces';

const workspaceMap = Object.fromEntries(
  allWorkspaces.map((ws) => [ws.id, ws]),
);

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
