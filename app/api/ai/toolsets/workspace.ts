import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from '@hudson/ai-backends/toolsets';

const toolScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

const system = `You are Hudson - a workspace-level AI assistant for a multi-app creative platform.

You must stay grounded in the live workspace context and the tools that are actually available in this session.

## Core behavior
- Act through tools whenever the user asks for a change.
- Use \`change_workspace_scope\` when the user wants to inspect or work against a different workspace without leaving the chat.
- Use \`load_workspace\` when the user wants Hudson AI to actually switch into another workspace and continue there live.
- Prefer \`run_command\` when an existing live command already matches the task.
- Use \`set_app_setting\` for app-level settings, \`set_shell_setting\` for Hudson preferences, and \`set_app_state\` for visibility/focus/disabled changes.
- Use \`service_action\` for service lifecycle actions and environment tools for local \`.env.local\` management.
- Use multiple tool calls for compound tasks.
- If a requested action is ambiguous or the target app/command is unclear, ask a short clarifying question.
- When scope mode is \`peek\`, treat that workspace as a static preview. Do not claim live app commands, live app settings, or pipe state there.
- When the target or focused app provides \`agentContext\`, treat it as the operating guide for that app's work. Apply app-specific tone and behavior only inside that app scope.

## Design taste
- Clean, intentional, professional
- Never use purple - prefer cyan, teal, emerald
- Less is more - remove before adding
- Optical corrections over mathematical perfection

## Response style
- After tool calls, summarize the exact change in 1-2 concise sentences. Mention the target app/item by name.
- If the tool call was only a request to perform an action and the live effect is not observable from tool output, phrase the response as "I sent..." or "I queued..." instead of claiming visual confirmation.
- Avoid generic filler when a specific result is available.
- Do not claim capabilities that are not represented in the provided context or tools.`;

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value.length === 0 ? '""' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatOptions(
  options: Array<{ value: string; label: string }> | undefined,
): string {
  if (!options || options.length === 0) return '';
  return ` options: ${options.map(option => `${option.label}=${option.value}`).join(', ')}`;
}

function context(ctx: Record<string, unknown>): string {
  const sections: string[] = [];

  const scope = ctx.scope as {
    workspaceId: string;
    workspaceName: string;
    mode: 'live' | 'peek';
    activeWorkspaceId: string;
    activeWorkspaceName: string;
    note?: string;
  } | undefined;
  if (scope) {
    sections.push([
      '## AI Scope',
      `- target: ${scope.workspaceName} (${scope.workspaceId})`,
      `- mode: ${scope.mode}`,
      `- activeWorkspace: ${scope.activeWorkspaceName} (${scope.activeWorkspaceId})`,
      `- note: ${scope.note ?? 'n/a'}`,
    ].join('\n'));
  }

  const workspace = ctx.workspace as {
    id: string;
    name: string;
    mode: 'canvas' | 'panel';
    focusedAppId?: string;
    visibleAppIds?: string[];
    disabledAppIds?: string[];
    availableWorkspaces?: Array<{ id: string; name: string; current?: boolean }>;
  } | undefined;
  if (workspace) {
    const available = workspace.availableWorkspaces?.map(candidate =>
      `${candidate.current ? '*' : '-'} ${candidate.name} (${candidate.id})`,
    ).join('\n') ?? '- none';
    sections.push([
      '## Workspace',
      `- ${workspace.name} (${workspace.id})`,
      `- mode: ${workspace.mode}`,
      `- focusedAppId: ${workspace.focusedAppId ?? 'none'}`,
      `- visibleAppIds: ${(workspace.visibleAppIds ?? []).join(', ') || 'none'}`,
      `- disabledAppIds: ${(workspace.disabledAppIds ?? []).join(', ') || 'none'}`,
      '- availableWorkspaces:',
      available,
    ].join('\n'));
  }

  const workspaces = ctx.workspaces as Array<{
    id: string;
    name: string;
    description?: string;
    mode: 'canvas' | 'panel';
    current?: boolean;
    defaultFocusedAppId?: string;
    apps: Array<{
      id: string;
      name: string;
      description?: string;
      agentContext?: string;
      mode: 'canvas' | 'panel';
      canvasMode?: 'native' | 'windowed';
      services?: Array<{ serviceId: string }>;
    }>;
  }> | undefined;
  if (workspaces && workspaces.length > 0) {
    sections.push([
      '## Workspace Catalog',
      workspaces.map(candidate => [
        `- ${candidate.current ? '*' : '-'} ${candidate.name} (${candidate.id})`,
        `  mode: ${candidate.mode}`,
        `  description: ${candidate.description ?? 'n/a'}`,
        `  defaultFocusedAppId: ${candidate.defaultFocusedAppId ?? 'none'}`,
        ...candidate.apps.map(app =>
          [
            `  - app: ${app.name} (${app.id}) | ${app.mode}${app.canvasMode ? ` / ${app.canvasMode}` : ''}${app.services?.length ? ` | services: ${app.services.map(service => service.serviceId).join(', ')}` : ''}`,
            app.agentContext ? `    agentContext: ${app.agentContext}` : '',
          ].filter(Boolean).join('\n'),
        ),
      ].join('\n')).join('\n'),
    ].join('\n'));
  }

  const apps = ctx.apps as Array<{
    id: string;
    name: string;
    description?: string;
    mode: 'canvas' | 'panel';
    canvasMode?: 'native' | 'windowed';
    visible?: boolean;
    disabled?: boolean;
    focused?: boolean;
    ports?: { inputs?: Array<{ id: string }>; outputs?: Array<{ id: string }> };
    tools?: Array<{ id: string; name: string }>;
    status?: { label: string; color: string } | null;
    activeToolHint?: string | null;
    services?: Array<{ serviceId: string; optional?: boolean }>;
    agentContext?: string;
  }> | undefined;
  if (apps && apps.length > 0) {
    sections.push([
      '## Apps',
      apps.map(app => {
        const inputs = app.ports?.inputs?.map(port => port.id).join(', ') || 'none';
        const outputs = app.ports?.outputs?.map(port => port.id).join(', ') || 'none';
        const tools = app.tools?.map(tool => tool.name).join(', ') || 'none';
        const services = app.services?.map(service => service.serviceId).join(', ') || 'none';
        return [
          `- ${app.name} (${app.id})`,
          `  mode: ${app.mode}${app.canvasMode ? ` / ${app.canvasMode}` : ''}`,
          `  visible: ${Boolean(app.visible)} | disabled: ${Boolean(app.disabled)} | focused: ${Boolean(app.focused)}`,
          `  description: ${app.description ?? 'n/a'}`,
          app.agentContext ? `  agentContext: ${app.agentContext}` : '',
          `  status: ${app.status ? `${app.status.label} (${app.status.color})` : 'n/a'}`,
          `  activeToolHint: ${app.activeToolHint ?? 'none'}`,
          `  tools: ${tools}`,
          `  inputs: ${inputs}`,
          `  outputs: ${outputs}`,
          `  services: ${services}`,
        ].join('\n');
      }).join('\n'),
    ].join('\n'));
  }

  const portCatalog = ctx.portCatalog as Array<{
    appId: string;
    appName: string;
    outputs: Array<{ id: string; name?: string; dataType?: string; description?: string }>;
    inputs: Array<{ id: string; name?: string; dataType?: string; description?: string }>;
  }> | undefined;
  if (portCatalog && portCatalog.length > 0) {
    sections.push([
      '## Port Catalog',
      portCatalog.map(entry => [
        `- ${entry.appName} (${entry.appId})`,
        `  outputs: ${entry.outputs.map(port => `${port.id}${port.description ? ` - ${port.description}` : ''}`).join('; ') || 'none'}`,
        `  inputs: ${entry.inputs.map(port => `${port.id}${port.description ? ` - ${port.description}` : ''}`).join('; ') || 'none'}`,
      ].join('\n')).join('\n'),
    ].join('\n'));
  }

  const commands = ctx.commands as Array<{
    id: string;
    label: string;
    shortcut?: string;
    scope: 'shell' | 'service' | 'app';
    appId?: string;
    appName?: string;
    description?: string;
  }> | undefined;
  if (commands && commands.length > 0) {
    sections.push([
      '## Live Commands',
      commands.map(command => {
        const owner = command.scope === 'app'
          ? `${command.appName ?? command.appId} / ${command.appId}`
          : command.scope;
        const shortcut = command.shortcut ? ` | shortcut: ${command.shortcut}` : '';
        const description = command.description ? ` - ${command.description}` : '';
        return `- ${command.id}: ${command.label} [${owner}]${shortcut}${description}`;
      }).join('\n'),
    ].join('\n'));
  }

  const appSettings = ctx.appSettings as Array<{
    appId: string;
    appName: string;
    sections: Array<{
      label: string;
      fields: Array<{
        key: string;
        label: string;
        type: string;
        current?: unknown;
        default?: unknown;
        min?: number;
        max?: number;
        step?: number;
        options?: Array<{ value: string; label: string }>;
      }>;
    }>;
  }> | undefined;
  if (appSettings && appSettings.length > 0) {
    sections.push([
      '## App Settings',
      appSettings.map(entry => [
        `- ${entry.appName} (${entry.appId})`,
        ...entry.sections.flatMap(section => [
          `  section: ${section.label}`,
          ...section.fields.map(field => {
            const range = field.min != null || field.max != null
              ? ` range: ${field.min ?? '-inf'}..${field.max ?? '+inf'}`
              : '';
            const step = field.step != null ? ` step: ${field.step}` : '';
            return `  - ${field.key}: ${field.label} [${field.type}] current=${formatValue(field.current)} default=${formatValue(field.default)}${range}${step}${formatOptions(field.options)}`;
          }),
        ]),
      ].join('\n')).join('\n'),
    ].join('\n'));
  }

  const shellSettings = ctx.shellSettings as Record<string, unknown> | undefined;
  if (shellSettings) {
    sections.push(`## Shell Settings\n\`\`\`json\n${JSON.stringify(shellSettings, null, 2)}\n\`\`\``);
  }

  const services = ctx.services as Array<{
    id: string;
    name: string;
    description?: string;
    version?: string;
    status: string;
    error?: string;
  }> | undefined;
  if (services && services.length > 0) {
    sections.push([
      '## Services',
      services.map(service =>
        `- ${service.name} (${service.id}) - status: ${service.status}${service.version ? ` | version: ${service.version}` : ''}${service.error ? ` | error: ${service.error}` : ''}${service.description ? ` | ${service.description}` : ''}`,
      ).join('\n'),
    ].join('\n'));
  }

  const pipes = ctx.pipes as Array<{
    name: string;
    enabled?: boolean;
    source: { appId: string; portId: string };
    sink: { appId: string; portId: string };
  }> | undefined;
  if (pipes && pipes.length > 0) {
    sections.push([
      '## Pipes',
      pipes.map(pipe =>
        `- ${pipe.name}: ${pipe.source.appId}.${pipe.source.portId} -> ${pipe.sink.appId}.${pipe.sink.portId} | enabled: ${pipe.enabled !== false}`,
      ).join('\n'),
    ].join('\n'));
  }

  const environment = ctx.environment as {
    manageable?: boolean;
    path?: string;
  } | undefined;
  if (environment?.manageable) {
    sections.push(`## Environment\n- Local environment management is available via ${environment.path ?? '.env.local'}. Use env tools only when the user explicitly wants credentials or local variables changed.`);
  }

  if (ctx.logoParams) {
    sections.push(`## Logo State\n\`\`\`json\n${JSON.stringify(ctx.logoParams, null, 2)}\n\`\`\``);
  }

  if (ctx.activeTemplate) {
    const template = ctx.activeTemplate as { name: string; id: string; sourceCode?: string; renderBody?: string };
    const code = template.sourceCode || template.renderBody || '';
    sections.push(`## Active Template: ${template.name} (${template.id})\n\`\`\`\n${code.slice(0, 2000)}\n\`\`\``);
  }

  return sections.join('\n\n');
}

function tools() {
  return {
    change_workspace_scope: tool({
      description: 'Change Hudson AI to another workspace. If the target is not the active workspace, Hudson AI enters peek mode with static workspace context.',
      inputSchema: z.object({
        workspaceId: z.string().describe('Target workspace ID from the Workspace Catalog section.'),
      }),
      execute: async (args) => ({ applied: true, action: 'change_workspace_scope', ...args }),
    }),

    load_workspace: tool({
      description: 'Make another workspace active so Hudson AI can operate there live instead of peeking.',
      inputSchema: z.object({
        workspaceId: z.string().describe('Target workspace ID from the Workspace Catalog section.'),
      }),
      execute: async (args) => ({ applied: true, action: 'load_workspace', ...args }),
    }),

    run_command: tool({
      description: 'Run an existing live Hudson command by exact command ID.',
      inputSchema: z.object({
        commandId: z.string().describe('Exact command ID from the Live Commands section.'),
      }),
      execute: async (args) => ({ applied: true, action: 'run_command', ...args }),
    }),

    set_app_setting: tool({
      description: 'Update a setting exposed by a specific app.',
      inputSchema: z.object({
        appId: z.string().describe('Target app ID.'),
        key: z.string().describe('App setting key from the App Settings section.'),
        value: toolScalarSchema.describe('New value for the setting.'),
      }),
      execute: async (args) => ({ applied: true, action: 'set_app_setting', ...args }),
    }),

    set_shell_setting: tool({
      description: 'Update a Hudson shell setting using a dotted key such as voice.replyProvider or font.fontSize.',
      inputSchema: z.object({
        key: z.string().describe('Shell setting key. Use the exact dotted path when nested.'),
        value: toolScalarSchema.describe('New setting value.'),
      }),
      execute: async (args) => ({ applied: true, action: 'set_shell_setting', ...args }),
    }),

    set_app_state: tool({
      description: 'Change app visibility, disabled state, or focus within the current workspace.',
      inputSchema: z.object({
        appId: z.string().describe('Target app ID.'),
        visible: z.boolean().optional().describe('Whether the app should be visible in the workspace.'),
        disabled: z.boolean().optional().describe('Whether the app should be disabled.'),
        focused: z.boolean().optional().describe('Whether the app should become focused.'),
      }),
      execute: async (args) => ({ applied: true, action: 'set_app_state', ...args }),
    }),

    service_action: tool({
      description: 'Run a service lifecycle action.',
      inputSchema: z.object({
        serviceId: z.string().describe('Target service ID.'),
        action: z.enum(['check', 'install', 'start', 'stop']).describe('Lifecycle action to execute.'),
      }),
      execute: async (args) => ({ applied: true, tool: 'service_action', ...args }),
    }),

    set_environment_variable: tool({
      description: 'Set or update a local environment variable in Hudson\'s .env.local management surface.',
      inputSchema: z.object({
        key: z.string().describe('Environment variable name, e.g. OPENAI_API_KEY.'),
        value: z.string().describe('Environment variable value.'),
      }),
      execute: async (args) => ({ applied: true, action: 'set_environment_variable', ...args }),
    }),

    delete_environment_variable: tool({
      description: 'Delete a local environment variable from Hudson\'s .env.local management surface.',
      inputSchema: z.object({
        key: z.string().describe('Environment variable name to delete.'),
      }),
      execute: async (args) => ({ applied: true, action: 'delete_environment_variable', ...args }),
    }),

    set_logo_param: tool({
      description: 'Set a parameter on the logo designer (colors, dimensions, layout).',
      inputSchema: z.object({
        key: z.string().describe('Parameter key such as bgColor, borderRadius, gapWidth, splitX, splitY, or padding.'),
        value: z.union([z.string(), z.number()]).describe('New value.'),
      }),
      execute: async (args) => ({ applied: true, app: 'logo-designer', ...args }),
    }),

    set_logo_custom_param: tool({
      description: 'Set a custom parameter on the active logo template.',
      inputSchema: z.object({
        key: z.string().describe('Custom parameter key.'),
        value: z.union([z.string(), z.number()]).describe('New value.'),
      }),
      execute: async (args) => ({ applied: true, app: 'logo-designer', action: 'set_custom_param', ...args }),
    }),

    set_logo_variant: tool({
      description: 'Switch the logo designer to a different template or variant.',
      inputSchema: z.object({
        variant: z.string().describe('Template ID.'),
      }),
      execute: async (args) => ({ applied: true, app: 'logo-designer', ...args }),
    }),

    push_pipe: tool({
      description: 'Push data through a named pipe.',
      inputSchema: z.object({
        pipeName: z.string().describe('Pipe name from the Pipes section.'),
      }),
      execute: async (args) => ({ applied: true, action: 'push_pipe', ...args }),
    }),

    delete_pipe: tool({
      description: 'Delete a named pipe.',
      inputSchema: z.object({
        pipeName: z.string().describe('Exact pipe name from the Pipes section.'),
      }),
      execute: async (args) => ({ applied: true, action: 'delete_pipe', ...args }),
    }),

    fetch_image: tool({
      description: 'Fetch an image from a URL and make it available for piping to other apps.',
      inputSchema: z.object({
        url: z.string().describe('Image URL to fetch.'),
      }),
      execute: async (args) => ({ applied: true, action: 'fetch_image', ...args }),
    }),

    create_template: tool({
      description: 'Create a new logo template. Write renderBody in TypeScript; it receives (p, vb) and must return the SVG inner string.',
      inputSchema: z.object({
        name: z.string().describe('Template name.'),
        description: z.string().describe('Short description.'),
        renderBody: z.string().describe('TypeScript function body.'),
        params: z.array(z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(['number', 'color', 'toggle', 'enum', 'text']),
          default: z.union([z.number(), z.string(), z.boolean()]),
          min: z.number().optional(),
          max: z.number().optional(),
          step: z.number().optional(),
        })).describe('Custom parameter declarations.'),
      }),
      execute: async (args) => ({ applied: true, action: 'create_template', ...args }),
    }),

    create_pipe: tool({
      description: 'Create a new pipe connecting two app ports.',
      inputSchema: z.object({
        name: z.string().describe('Pipe name.'),
        sourceAppId: z.string().describe('Source app ID.'),
        sourcePortId: z.string().describe('Source output port ID.'),
        sinkAppId: z.string().describe('Sink app ID.'),
        sinkPortId: z.string().describe('Sink input port ID.'),
      }),
      execute: async (args) => ({ applied: true, action: 'create_pipe', ...args }),
    }),

    generate_image: tool({
      description: 'Generate an image from a text prompt using Gemini/Imagen.',
      inputSchema: z.object({
        prompt: z.string().describe('Detailed description of the image to generate.'),
        aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).optional().describe('Aspect ratio.'),
      }),
      execute: async (args) => ({ applied: true, action: 'generate_image', ...args }),
    }),
  };
}

export const workspaceToolset: ToolsetDefinition = { system, context, tools };
