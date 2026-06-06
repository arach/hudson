export type { RuntimeCompanionStatus, RuntimeNodeSummary } from '@/app/lib/runtime/types';

export type RuntimeCompanionPhase = 'checking' | 'offline' | 'online';

export interface RuntimeWorkspaceView {
  workspaceID?: string;
  nodeCount: number;
  selectedNodeIDs: string[];
}
