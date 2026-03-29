import { z } from 'zod';
import { logoToolset } from './logo';
import { workspaceToolset } from './workspace';

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
  workspace: workspaceToolset,
};

/**
 * Convert the Zod-based tool definitions into a text block that can be
 * embedded in the system prompt for CLI mode (which doesn't support native
 * tool definitions). The model is instructed to emit `<tool name="...">` tags
 * which the CLI streaming parser can pick up.
 */
export function generateToolPrompt(
  tools: Record<string, { description?: string; inputSchema?: z.ZodType }>,
): string {
  const entries = Object.entries(tools);
  if (entries.length === 0) return '';

  const toolDocs = entries.map(([name, def]) => {
    const desc = def.description ?? '';
    let schemaStr = '{}';
    if (def.inputSchema) {
      try {
        const jsonSchema = z.toJSONSchema(def.inputSchema);
        schemaStr = JSON.stringify(jsonSchema, null, 2);
      } catch {
        schemaStr = '{}';
      }
    }
    return `### ${name}\n${desc}\n\nInput schema:\n\`\`\`json\n${schemaStr}\n\`\`\``;
  }).join('\n\n');

  return `## Available Tools

You have access to the following tools. To call a tool, emit a tag in this exact format:

<tool name="tool_name">{"param": "value"}</tool>

You may call multiple tools in one response. Always emit valid JSON inside the tag.

${toolDocs}`;
}

export function loadToolset(id: string, context: Record<string, unknown>) {
  const entry = registry[id];
  if (!entry) return { tools: {}, system: undefined, toolPrompt: '' };

  // Compose the full system prompt: app knowledge + instance context
  const system = [
    entry.system,
    entry.context(context),
  ].filter(Boolean).join('\n\n---\n\n');

  const tools = entry.tools(context);

  return {
    tools,
    system,
    toolPrompt: generateToolPrompt(tools as Record<string, { description?: string; inputSchema?: z.ZodType }>),
  };
}
