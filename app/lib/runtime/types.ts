export interface RuntimeControlPaths {
  id: string;
  label: string;
  commandPath: string;
  responsePath: string;
  statePath: string;
}

export interface RuntimeControlCommand {
  apiVersion?: string;
  kind?: string;
  id: string;
  action: string;
  [key: string]: unknown;
}

export interface RuntimeNodeSummary {
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

export interface RuntimeControlResponse {
  apiVersion?: string;
  kind?: string;
  id?: string;
  action?: string;
  ok: boolean;
  message?: string;
  workspaceID?: string;
  nodeCount?: number;
  selectedNodeIDs?: string[];
  nodes?: RuntimeNodeSummary[];
  commandPath?: string;
  responsePath?: string;
  statePath?: string;
  durationMS?: number;
  timestamp?: string;
  error?: string;
}

export interface RuntimeCompanionStatus {
  online: boolean;
  profileId: string;
  profileLabel: string;
  commandPath: string;
  responsePath: string;
  statePath: string;
  workspaceID?: string;
  nodeCount?: number;
  selectedNodeIDs?: string[];
  nodes?: RuntimeNodeSummary[];
  message?: string;
  lastCheckedAt: string;
  latencyMs?: number;
}

export interface RuntimeIntegrationDescriptor {
  id: 'hudsonkit-runtime';
  name: 'HudsonKit Runtime';
  brand: {
    name: 'HudsonKit';
    product: 'Runtime';
    logo: string;
    accent: 'cyan';
  };
  description: string;
  controlProfiles: RuntimeControlPaths[];
  commands: string[];
  updatedAt: string;
}
