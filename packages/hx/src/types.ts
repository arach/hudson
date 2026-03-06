// ---------------------------------------------------------------------------
// hx — Type definitions
// ---------------------------------------------------------------------------

export interface HxService {
  id: string;
  name: string;
  port: number;
  host?: string;
  type: 'agent' | 'app' | 'api' | 'custom';
  endpoints?: string[];
  meta?: Record<string, unknown>;
  registeredAt: number;
  lastSeenAt: number;
}

export interface HxConfig {
  port: number;
  hudsonUrl: string;
}

export const DEFAULT_CONFIG: HxConfig = {
  port: 4800,
  hudsonUrl: 'http://localhost:3500',
};
