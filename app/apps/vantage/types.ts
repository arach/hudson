export type { VantageCompanionStatus, VantageNodeSummary } from '@/app/lib/vantage/types';

export type VantageCompanionPhase = 'checking' | 'offline' | 'online';

export interface VantageWorkspaceView {
  workspaceID?: string;
  nodeCount: number;
  selectedNodeIDs: string[];
}
