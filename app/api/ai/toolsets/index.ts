import { z } from 'zod';
import { defaultRegistry } from '@hudson/ai-backends/toolsets';
import { logoToolset } from './logo';
import { workspaceToolset } from './workspace';
import { intentsToolset } from './intents';
import { shaperToolset } from './shaper';
import { dayStackToolset } from './day-stack';

// Re-export the canonical ToolsetDefinition type from the package so any
// remaining internal imports of `ToolsetDefinition from './index'` still work.
export type { ToolsetDefinition } from '@hudson/ai-backends/toolsets';

// Register the app's toolsets on the package's default registry at module init.
defaultRegistry.register('logo', logoToolset);
defaultRegistry.register('workspace', workspaceToolset);
defaultRegistry.register('intents', intentsToolset);
defaultRegistry.register('shaper', shaperToolset);
defaultRegistry.register('day-stack', dayStackToolset);

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
  const entry = defaultRegistry.resolve(id);
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
