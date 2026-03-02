import { logoTools, logoSystemPrompt } from './logo';

type ToolsetEntry = {
  tools: (context: Record<string, unknown>) => Record<string, unknown>;
  system: (context: Record<string, unknown>) => string;
};

const registry: Record<string, ToolsetEntry> = {
  logo: { tools: logoTools, system: logoSystemPrompt },
};

export function loadToolset(id: string, context: Record<string, unknown>) {
  const entry = registry[id];
  if (!entry) return { tools: {}, system: undefined };
  return {
    tools: entry.tools(context),
    system: entry.system(context),
  };
}
