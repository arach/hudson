// ---------------------------------------------------------------------------
// Service system types
// ---------------------------------------------------------------------------

export type ServiceStatus = 'unknown' | 'not_installed' | 'installed' | 'running' | 'error';

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  icon?: string;
  check: {
    healthUrl?: string;
    port?: number;
  };
  install: { command: string; cwd?: string };
  start: { command: string; cwd?: string; env?: Record<string, string> };
  stop?: { command?: string };
}

export interface ServiceDependency {
  serviceId: string;
  optional?: boolean;
  reason?: string;
}

export interface ServiceRecord {
  serviceId: string;
  status: ServiceStatus;
  pid?: number;
  logFile?: string;
  lastChecked: number;
  lastChanged: number;
  error?: string;
}

export interface ServiceAction {
  id: string;
  serviceId: string;
  action: 'check' | 'install' | 'start' | 'stop';
  triggeredBy: 'user' | 'agent' | 'system';
  timestamp: number;
  command?: string;
  output?: string;
  exitCode?: number | null;
  success: boolean;
  durationMs: number;
}
