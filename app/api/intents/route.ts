import { NextRequest, NextResponse } from 'next/server';
import { buildIntentCatalog } from '../../lib/intent-catalog';
import { allWorkspaces } from '../../workspaces';
import '../../intents-registry'; // side-effect: populates the runtime registry
import { intentMetaToServerIntent, listIntents } from '../../lib/intent';

export const runtime = 'nodejs';

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

  const serverIntents = listIntents().map(({ meta }) => intentMetaToServerIntent(meta));
  const catalog = buildIntentCatalog(workspace, { serverIntents });
  return NextResponse.json(catalog);
}
