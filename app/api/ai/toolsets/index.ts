import { logoToolset } from './logo';

export interface ToolsetDefinition {
  /** Static app-level system prompt — capabilities, personality, constraints. */
  system: string;
  /** Dynamic instance context — current state snapshot. Receives the context from the client. */
  context: (ctx: Record<string, unknown>) => string;
  /** Tool definitions. Receives context for validation/defaults. */
  tools: (ctx: Record<string, unknown>) => Record<string, unknown>;
}

const registry: Record<string, ToolsetDefinition> = {
  logo: logoToolset,
};

export function loadToolset(id: string, context: Record<string, unknown>) {
  const entry = registry[id];
  if (!entry) return { tools: {}, system: undefined };

  // Compose the full system prompt: app knowledge + instance context
  const system = [
    entry.system,
    entry.context(context),
  ].filter(Boolean).join('\n\n---\n\n');

  return {
    tools: entry.tools(context),
    system,
  };
}
