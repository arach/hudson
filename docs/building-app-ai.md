---
title: "Building app AI"
description: "Adding an AI surface to a Hudson app — the toolset + hook pattern"
order: 12
section: "Web"
---

# Building app AI

This guide is for agents and authors adding an AI surface (chat composer + tool-driven actions) to a Hudson app. The pattern is **two files**: one server-side toolset, one client-side hook. Once you know the shape, copy the reference app that's closest to what you're building and edit.

> Working examples to copy from, simplest first:
> - **`app/apps/hudson-ai/`** — model/provider settings, chat surface, and workspace-level AI affordances.
> - **`app/api/ai/toolsets/workspace.ts`** — shell/workspace tools, including service-backed actions.
> - **`app/api/ai/toolsets/intents.ts`** — intent-catalog tools that bridge AI to live app commands.

## Mental model

The server defines **what** the AI can do (system prompt, tool schemas). The client defines **what to do with results** (apply state changes when a tool fires). The two halves meet at one string: the toolset id.

```
client                                       server
useFooAI(opts)            POST /api/ai/chat   route.ts
  ↓ context = { ... }    ───────────────────→   ↓
  useHudsonAI({                                createPiAiBackend().streamUI({
    toolset: 'foo', ...                          messages, toolset: 'foo', ...
    onToolCall: ...                            })
  })                                             ↓
                                               defaultRegistry.resolve('foo')
                                                 ↓
                                               { system, context(ctx), tools(ctx) }
                                                 ↓
                                               pi-ai stream → tool_call
  text-delta /                                 ←──────────────────────
  tool-input-available
  ↓
onToolCall('set_x', { ... })  →  app state changes
```

The route, the backend, the multi-step tool loop — none of that is your concern. You write a server toolset and a client hook.

## File layout

For a new app `foo`:

```
app/api/ai/toolsets/foo.ts       ← server: system prompt, context renderer, tool schemas
app/apps/foo/useFooAI.ts         ← client: useHudsonAI() wrapper + onToolCall router
app/api/ai/toolsets/index.ts     ← add one line: defaultRegistry.register('foo', fooToolset)
```

Naming conventions:
- Toolset id matches app id (`foo` ↔ `app/apps/foo/`).
- Hook is `useFooAI` (PascalCase app name).
- Toolset export is `fooToolset` (lowercase, matches id).

## Server side — the toolset

A `ToolsetDefinition` has three parts: `system`, `context(ctx)`, `tools(ctx)`. The shape is enforced by `import type { ToolsetDefinition } from '@hudsonkit/ai/toolsets'`.

```ts
// app/api/ai/toolsets/foo.ts
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from '@hudsonkit/ai/toolsets';

// ─── System prompt ──────────────────────────────────────────────────────────
// Static. Personality, taste, capability docs. Doesn't change per request.
const system = `You are a [role] working in [app]. [Voice / taste constraints.]

## How this works
[How the app surfaces work + what tools do.]

## Design rules
- Never use purple. Prefer cyan, teal, emerald.
- [Other taste constraints from CLAUDE.md.]

## Response style
- Brief. After tool calls, summarize what changed in 1-2 sentences.
- Don't narrate. Don't apologize.`;

// ─── Context renderer ───────────────────────────────────────────────────────
// Dynamic. Recomputed every request from whatever the client puts in `context`.
function context(ctx: Record<string, unknown>): string {
  const c = ctx as { items?: unknown[]; mode?: string };
  const sections: string[] = [];

  if (c.mode) sections.push(`## Mode\n${c.mode}`);
  if (c.items?.length) {
    sections.push(`## Items (${c.items.length})\n\`\`\`json\n${JSON.stringify(c.items, null, 2)}\n\`\`\``);
  }
  return sections.join('\n\n');
}

// ─── Tools ──────────────────────────────────────────────────────────────────
// Zod-validated schemas. The `execute` callback runs server-side but is almost
// always an echo — the real mutation happens client-side via `onToolCall`.
function tools(_ctx: Record<string, unknown>) {
  return {
    set_mode: tool({
      description: 'Switch the app into a different mode.',
      inputSchema: z.object({
        mode: z.enum(['draft', 'review', 'published']).describe('Target mode'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),
    add_item: tool({
      description: 'Add a new item to the current list.',
      inputSchema: z.object({
        title: z.string().describe('Display name'),
        priority: z.number().int().min(1).max(5).optional().describe('1=low, 5=high'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),
  };
}

export const fooToolset: ToolsetDefinition = { system, context, tools };
```

Register it once in `app/api/ai/toolsets/index.ts`:

```ts
import { fooToolset } from './foo';
defaultRegistry.register('foo', fooToolset);
```

### Tool design rules

- **Schemas with `.describe()` everywhere.** The model reads these. Don't skip them.
- **Tool names are snake_case verbs**: `set_param`, `add_item`, `delete_template`. Never `setParam` or `Item.add`.
- **One responsibility per tool.** If you find yourself writing `do_thing` with a switch inside, split it.
- **`execute` is usually an echo, not the action.** Return `{ applied: true, ...args }` (or a small status object). The actual state change usually happens in the client's `onToolCall`. The exception is work that genuinely belongs server-side: service execution, database writes, compilation, or fetches.
- **Use `z.enum` over `z.string`** when there's a fixed list. The model gets clearer guidance and you get validation.
- **Optional params are optional.** Don't force the model to always pass everything.

### System prompt voice

Match the existing apps. They follow this skeleton:

```
You are a [role specific to the app].

## How this works
[1-2 paragraphs explaining the app surface + what tools do.]

## [Domain rules — taste, parameters, constraints]
[Bullets. Specific. Concrete examples.]

## Response style
- [Brevity constraints]
- [What to do after tool calls]
```

Hudson-global constraints to include in every prompt:
- "Never use purple. Prefer cyan, teal, emerald."
- "Less is more — remove before adding."
- "Optical corrections over mathematical perfection."

Don't make the model recite these — embed them in the taste section so they shape every decision.

## Client side — the hook

The hook glues app state to `useHudsonAI`. Three things you control: `context`, `onToolCall`, and (optionally) `attachments`.

```ts
// app/apps/foo/useFooAI.ts
'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useHudsonAI } from 'hudsonkit';
import type { AIAttachment, AppSettingsValues } from 'hudsonkit';

interface UseFooAIOptions {
  // App state the AI can read
  items: Item[];
  mode: Mode;
  // App setters the AI can drive (via onToolCall)
  setMode: (mode: Mode) => void;
  addItem: (item: Item) => void;
  // App settings for provider/model selection
  appSettings: AppSettingsValues;
}

export interface AiActivityEntry {
  id: number;
  tool: string;
  summary: string;
  timestamp: number;
}
let _activityId = 0;

export function useFooAI(opts: UseFooAIOptions) {
  const { items, mode, setMode, addItem, appSettings } = opts;

  // Activity log — surfaces "what did the AI just do" in the UI
  const [activity, setActivity] = useState<AiActivityEntry[]>([]);
  const logActivity = useCallback((tool: string, summary: string) => {
    setActivity(prev => [...prev.slice(-9), { id: ++_activityId, tool, summary, timestamp: Date.now() }]);
  }, []);

  // What the AI sees — sent with every request. Wrap in useMemo so the
  // transport's body() function reads stable references.
  const context = useMemo(() => ({ items, mode }), [items, mode]);

  // Opt-in extras the user can toggle from the chat composer
  const attachments: AIAttachment[] = useMemo(() => [
    {
      label: 'Selection',
      content: () => {
        const el = document.querySelector('[data-selected]');
        return el ? el.outerHTML : null;
      },
    },
  ], []);

  const chat = useHudsonAI({
    toolset: 'foo',                           // ← matches server registration
    chatId: 'foo-app-chat',                   // ← stable id; persists across remounts
    context,
    attachments,
    provider: String(appSettings.aiProvider || 'copilot'),
    model: String(appSettings.aiModel || 'gemini-3-flash-preview'),
    onToolCall: async (name, args) => {
      try {
        switch (name) {
          case 'set_mode':
            setMode(args.mode as Mode);
            logActivity('set_mode', String(args.mode));
            break;
          case 'add_item':
            addItem({ id: crypto.randomUUID(), title: args.title as string, ... });
            logActivity('add_item', `Added "${args.title}"`);
            break;
        }
      } catch (err) {
        logActivity('error', `${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });

  // Surface chat errors in the activity log
  useEffect(() => {
    if (chat?.error) logActivity('error', String(chat.error).slice(0, 80));
  }, [chat?.error, logActivity]);

  return {
    sendAiMessage: (message: string) => chat.sendMessage({ text: message }),
    aiStatus: chat?.status ?? 'ready',
    aiMessages: chat?.messages ?? [],
    aiActivity: activity,
    aiError: chat?.error ? String(chat.error) : null,
    aiChat: chat,                              // full handle for surfaces using <AI/>
  };
}
```

### Client patterns to follow

- **`useMemo` on `context`.** It's sent on every request; identity churn = wasted re-renders.
- **`attachments` ≠ `context`.** Attachments are user-toggled (chip in the composer). Use them for big payloads (current SVG, file dump) the user might NOT want sent every turn.
- **`onToolCall` does the actual work, not `execute`.** Centralize app-state mutations here.
- **Coerce values defensively.** Some models (notably MiniMax) send string-encoded numbers (`"20"` not `20`). Coerce inside `onToolCall` for numeric params.
- **Log activity.** Users want to see "what did it just do". The 10-entry rolling log pattern (`prev.slice(-9)`) is the convention.
- **Wrap `chat.sendMessage` in your own helper** if you want logging or pre/post hooks.

## Provider / model selection

Default to whatever the app's settings say:

```ts
provider: String(appSettings.aiProvider || 'copilot'),
model: String(appSettings.aiModel || 'gemini-3-flash-preview'),
```

`appSettings.aiProvider` and `appSettings.aiModel` come from the app's declarative settings schema (see `docs/settings.md`). If your app doesn't expose these as user-tunable settings, hardcode sensible defaults — but pick `copilot` + a Gemini-flash model unless you have a specific reason. They're fastest and cheapest for tool-driven work.

Available providers today (see `app/api/ai/providers.ts`):
- `copilot` (GitHub Copilot, OAuth via OpenCode auth.json)
- `anthropic`, `openai`, `groq`, `xai`, `google`, `github`, `minimax`

The backend handles credential resolution; you just pass the provider id.

## Verification

After wiring the two files + the registration line:

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Tests (if you added any)
npx vitest run

# 3. Smoke the endpoint (dev server on 3500)
curl -sS -X POST http://localhost:3500/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"hello"}]}],"toolset":"foo","context":{},"mode":"api"}' \
  --max-time 30 | head -10
# Should see: data: {"type":"start"}, text-start, text-delta, [DONE]

# 4. Trigger a tool call
curl -sS -X POST http://localhost:3500/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"switch to review mode"}]}],"toolset":"foo","context":{"mode":"draft"},"mode":"api"}' \
  --max-time 30 | grep -E "tool-input|text-delta" | head -5
```

In the running app, open the AI composer and ask the model to do something covered by your tools. Watch the activity log update.

## Common pitfalls

- **Forgot to register the toolset.** `loadToolset('foo', ctx)` returns `{tools: {}, system: undefined}` silently. Symptom: model responds chatty but never calls tools.
- **Tool schemas without descriptions.** Model invokes tools but with wrong arg shapes. Add `.describe()` to every field.
- **`context` not memoized.** Identity churn → request body churn. Symptom: weird state-mid-request bugs.
- **Trying to read app state in the toolset's `tools(ctx)`.** `ctx` is the request's context object only. If you need app state, put it in `context` on the client side.
- **Returning state from `execute`.** It echoes to the client as `tool-output-available`, but apps don't typically read that. Mutate via `onToolCall`.

## Future: declarative `ai: hudAI({...})`

The current pattern requires a hook file + a toolset file + a registration line. The brief (HUD-006 step 5) envisions collapsing this into a single field on `HudsonApp`:

```ts
// future
import { hudAI } from 'hudsonkit';
export const fooApp: HudsonApp = {
  id: 'foo',
  name: 'Foo',
  ai: hudAI({ toolset: 'foo', backend: 'pi-ai' }),
  // ...
};
```

Until that lands, the two-file pattern above is the path. The convention is stable — the future migration will be mechanical.
