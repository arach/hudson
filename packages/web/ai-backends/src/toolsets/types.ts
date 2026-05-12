// ---------------------------------------------------------------------------
// Toolset definition shape
// ---------------------------------------------------------------------------

export interface ToolsetDefinition {
  /** Static app-level system prompt — capabilities, personality, constraints. */
  system: string;

  /** Dynamic instance context — current state snapshot. */
  context: (ctx: Record<string, unknown>) => string;

  /**
   * Tool definitions. Each key is a tool name; values are tool objects
   * (typically from the Vercel AI SDK `tool()` helper or equivalent shapes
   * with `description` + `inputSchema` + optional `execute`).
   */
  tools: (ctx: Record<string, unknown>) => Record<string, unknown>;
}
