export interface VantageControlPaths {
  id: string;
  label: string;
  commandPath: string;
  responsePath: string;
  statePath: string;
}

export interface VantageControlCommand {
  apiVersion?: string;
  kind?: string;
  id: string;
  action: string;
  [key: string]: unknown;
}

export interface VantageNodeSummary {
  id: string;
  title?: string;
  subtitle?: string;
  selected?: boolean;
  runtimeKind?: string;
  tmuxTarget?: string;
  remoteHost?: string;
  tag?: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface VantageControlResponse {
  apiVersion?: string;
  kind?: string;
  id?: string;
  action?: string;
  ok: boolean;
  message?: string;
  workspaceID?: string;
  nodeCount?: number;
  selectedNodeIDs?: string[];
  nodes?: VantageNodeSummary[];
  commandPath?: string;
  responsePath?: string;
  statePath?: string;
  durationMS?: number;
  timestamp?: string;
  error?: string;
}

export interface VantageCompanionStatus {
  online: boolean;
  profileId: string;
  profileLabel: string;
  commandPath: string;
  responsePath: string;
  statePath: string;
  workspaceID?: string;
  nodeCount?: number;
  selectedNodeIDs?: string[];
  nodes?: VantageNodeSummary[];
  message?: string;
  lastCheckedAt: string;
  latencyMs?: number;
}

export interface VantageIntegrationDescriptor {
  id: 'hudsonkit-vantage';
  name: 'HudsonKit Vantage';
  brand: {
    name: 'HudsonKit';
    product: 'Vantage';
    logo: string;
    accent: 'cyan';
  };
  description: string;
  controlProfiles: VantageControlPaths[];
  commands: string[];
  updatedAt: string;
}
