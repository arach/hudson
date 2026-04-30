import type { HudsonWorkspace } from 'hudsonkit';

export interface WorkspaceRegistryEntry {
  workspace: HudsonWorkspace;
  source: string;
}

export interface WorkspaceDuplicate {
  id: string;
  keptSource: string;
  skippedSource: string;
}

export function uniqueWorkspaces(
  entries: WorkspaceRegistryEntry[],
  onDuplicate?: (duplicate: WorkspaceDuplicate) => void,
): HudsonWorkspace[] {
  const sourcesById = new Map<string, string>();
  const workspaces: HudsonWorkspace[] = [];

  for (const { workspace, source } of entries) {
    const keptSource = sourcesById.get(workspace.id);
    if (keptSource) {
      onDuplicate?.({ id: workspace.id, keptSource, skippedSource: source });
      continue;
    }

    sourcesById.set(workspace.id, source);
    workspaces.push(workspace);
  }

  return workspaces;
}
