// ---------------------------------------------------------------------------
// Trace Viewer — type definitions
// ---------------------------------------------------------------------------

export interface AgentTrace {
  id: string;
  name: string;
  agent: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt: number | null;
  totalDurationMs: number | null;
  totalTokens?: { input: number; output: number };
  error?: string;
  steps: TraceStep[];
}

export interface TraceStep {
  index: number;
  type: 'tool_call' | 'message' | 'thinking';
  tool?: string;
  summary: string;
  input?: unknown;
  output?: unknown;
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  tokens?: { input: number; output: number };
  startedAt: number;
}

export interface TraceSummary {
  id: string;
  name: string;
  agent: string;
  model?: string;
  status: AgentTrace['status'];
  startedAt: number;
  completedAt: number | null;
  totalDurationMs: number | null;
  stepCount: number;
  error?: string;
}
