#!/usr/bin/env bun

import {
  AGENT_LOG_FILE,
  appendAgentLog,
  appendAgentTaskLog,
  makeTraceId,
} from '../app/lib/agent-log-core';

type AgentActionCommand = 'start' | 'log' | 'complete' | 'fail';

interface ParsedArgs {
  command: AgentActionCommand;
  flags: Record<string, string | true>;
  args: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const HELP = `Usage:
  bun scripts/agent-action.ts start --prompt "Create a logo" --action logo.create --actor codex
  bun scripts/agent-action.ts log --trace tr_x --message "Created first template" --action logo.create
  bun scripts/agent-action.ts complete --trace tr_x --message "Delivered logo variants" --action logo.create
  bun scripts/agent-action.ts fail --trace tr_x --message "Compile failed" --error "Missing source"

Commands:
  start      Record that an agent accepted a prompt/task. Prints a traceId.
  log        Record a milestone within a task.
  complete   Record successful task completion.
  fail       Record task failure.

Common flags:
  --prompt, --message, --trace, --source, --origin, --actor, --action
  --app, --app-name, --workspace, --workspace-name, --target, --chat
  --arg key=value       Add an args field. Repeatable.
  --meta key=value      Add a metadata field. Repeatable.

Use --prompt - or --message - to read that field from stdin.`;

function parse(argv: string[]): ParsedArgs {
  const [rawCommand, ...rest] = argv;
  if (!rawCommand || rawCommand === '--help' || rawCommand === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  if (!['start', 'log', 'complete', 'fail'].includes(rawCommand)) {
    throw new Error(`Unknown command "${rawCommand}".\n\n${HELP}`);
  }

  const flags: Record<string, string | true> = {};
  const args: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected positional argument "${token}".`);
    }

    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = normalizeFlag(rawKey);
    const value = inlineValue !== undefined
      ? inlineValue
      : rest[i + 1] && !rest[i + 1].startsWith('--')
        ? rest[++i]
        : true;

    if (key === 'arg' || key === 'meta') {
      if (value === true) throw new Error(`--${key} requires key=value.`);
      const [field, fieldValue] = splitAssignment(value);
      (key === 'arg' ? args : metadata)[field] = parseValue(fieldValue);
      continue;
    }

    flags[key] = value;
  }

  return { command: rawCommand as AgentActionCommand, flags, args, metadata };
}

function normalizeFlag(flag: string) {
  return flag.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
}

function splitAssignment(value: string): [string, string] {
  const index = value.indexOf('=');
  if (index <= 0) throw new Error(`Expected key=value, got "${value}".`);
  return [value.slice(0, index), value.slice(index + 1)];
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function stringFlag(flags: Record<string, string | true>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = flags[name];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

async function textFlag(flags: Record<string, string | true>, name: string): Promise<string | undefined> {
  const value = stringFlag(flags, name);
  if (value !== '-') return value;
  return (await Bun.stdin.text()).trim();
}

function inferSource() {
  if (process.env.HUDSON_AGENT_SOURCE) return process.env.HUDSON_AGENT_SOURCE;
  if (process.env.CODEX_HOME || process.env.CODEX_SANDBOX) return 'codex';
  if (process.env.CLAUDECODE || process.env.CLAUDE_BIN) return 'claude-code';
  return 'cli';
}

function result(traceId: string, command: AgentActionCommand) {
  console.log(JSON.stringify({
    ok: true,
    command,
    traceId,
    logFile: AGENT_LOG_FILE,
  }));
}

const parsed = parse(process.argv.slice(2));
const traceId = stringFlag(parsed.flags, 'trace', 'trace-id') ?? process.env.HUDSON_AGENT_TRACE_ID ?? makeTraceId();
const source = stringFlag(parsed.flags, 'source') ?? inferSource();
const origin = stringFlag(parsed.flags, 'origin') ?? process.env.HUDSON_AGENT_ORIGIN ?? source;
const actor = stringFlag(parsed.flags, 'actor') ?? process.env.HUDSON_AGENT_ACTOR ?? process.env.USER;
const action = stringFlag(parsed.flags, 'action') ?? process.env.HUDSON_AGENT_ACTION ?? 'agent.task';
const prompt = await textFlag(parsed.flags, 'prompt');
const message = await textFlag(parsed.flags, 'message');

const common = {
  source,
  origin,
  actor,
  action,
  traceId,
  appId: stringFlag(parsed.flags, 'app', 'app-id'),
  appName: stringFlag(parsed.flags, 'app-name'),
  workspaceId: stringFlag(parsed.flags, 'workspace', 'workspace-id'),
  workspaceName: stringFlag(parsed.flags, 'workspace-name'),
  target: stringFlag(parsed.flags, 'target'),
  chatId: stringFlag(parsed.flags, 'chat', 'chat-id'),
  args: Object.keys(parsed.args).length > 0 ? parsed.args : undefined,
  metadata: Object.keys(parsed.metadata).length > 0 ? parsed.metadata : undefined,
};

if (parsed.command === 'log') {
  await appendAgentLog({
    ...common,
    message: message ?? 'agent.task.milestone',
    level: 'info',
    triggeredBy: 'agent',
    playbook: action,
    args: {
      ...(common.args ?? {}),
      ...(prompt ? { prompt } : {}),
    },
  });
  result(traceId, parsed.command);
  process.exit(0);
}

await appendAgentTaskLog({
  ...common,
  status: parsed.command === 'fail' ? 'failed' : parsed.command === 'complete' ? 'completed' : 'started',
  prompt,
  message,
  error: stringFlag(parsed.flags, 'error'),
});
result(traceId, parsed.command);
