import { spawn } from 'child_process';
import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import { loadToolset } from '../toolsets';

// ---------------------------------------------------------------------------
// Tool-call parser — streaming state machine
// ---------------------------------------------------------------------------
// Detects `<tool name="...">JSON</tool>` in the text stream.
// States: TEXT → TAG_OPEN → BODY → TAG_CLOSE

const TOOL_OPEN_RE = /<tool\s+name="([^"]+)">/;
const TOOL_CLOSE = '</tool>';

type ParserState = 'TEXT' | 'TAG_OPEN' | 'BODY';

interface ToolCallParserEvent {
  type: 'text' | 'tool-call';
  text?: string;
  toolName?: string;
  input?: Record<string, unknown>;
}

class ToolCallParser {
  private state: ParserState = 'TEXT';
  private buffer = '';
  private toolName = '';
  private bodyBuffer = '';

  /** Feed a chunk of text, returns parsed events. */
  feed(chunk: string): ToolCallParserEvent[] {
    const events: ToolCallParserEvent[] = [];
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (this.state === 'TEXT') {
        const idx = this.buffer.indexOf('<tool ');
        if (idx === -1) {
          // No opening tag — could be a partial at end of buffer.
          // Keep last few chars in case `<tool` is split across chunks.
          const safe = this.buffer.length > 10 ? this.buffer.length - 10 : 0;
          if (safe > 0) {
            events.push({ type: 'text', text: this.buffer.slice(0, safe) });
            this.buffer = this.buffer.slice(safe);
          }
          break;
        }
        // Emit text before the tag
        if (idx > 0) {
          events.push({ type: 'text', text: this.buffer.slice(0, idx) });
        }
        this.buffer = this.buffer.slice(idx);
        this.state = 'TAG_OPEN';
      }

      if (this.state === 'TAG_OPEN') {
        // Try to match the full opening tag
        const match = this.buffer.match(TOOL_OPEN_RE);
        if (!match) {
          // Incomplete tag — wait for more data
          break;
        }
        const fullOpen = match[0];
        this.toolName = match[1];
        this.bodyBuffer = '';
        this.buffer = this.buffer.slice(this.buffer.indexOf(fullOpen) + fullOpen.length);
        this.state = 'BODY';
      }

      if (this.state === 'BODY') {
        const closeIdx = this.buffer.indexOf(TOOL_CLOSE);
        if (closeIdx === -1) {
          // Accumulate body, wait for closing tag
          this.bodyBuffer += this.buffer;
          this.buffer = '';
          break;
        }
        this.bodyBuffer += this.buffer.slice(0, closeIdx);
        this.buffer = this.buffer.slice(closeIdx + TOOL_CLOSE.length);

        // Parse JSON body
        try {
          const input = JSON.parse(this.bodyBuffer.trim());
          events.push({ type: 'tool-call', toolName: this.toolName, input });
        } catch {
          // Malformed JSON — emit as text
          events.push({ type: 'text', text: `<tool name="${this.toolName}">${this.bodyBuffer}</tool>` });
        }
        this.state = 'TEXT';
      }
    }

    return events;
  }

  /** Flush remaining buffer as text. */
  flush(): ToolCallParserEvent[] {
    const events: ToolCallParserEvent[] = [];
    if (this.state === 'BODY') {
      // Unterminated tool tag — emit as text
      events.push({ type: 'text', text: `<tool name="${this.toolName}">${this.bodyBuffer}${this.buffer}` });
    } else if (this.buffer.length > 0) {
      events.push({ type: 'text', text: this.buffer });
    }
    this.buffer = '';
    this.bodyBuffer = '';
    this.state = 'TEXT';
    return events;
  }
}

// ---------------------------------------------------------------------------
// Execute tool calls against the toolset
// ---------------------------------------------------------------------------
async function executeTool(
  tools: Record<string, { execute?: (args: Record<string, unknown>) => Promise<unknown> }>,
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const t = tools[toolName];
  if (!t?.execute) return { error: `Unknown tool: ${toolName}` };
  try {
    return await t.execute(input);
  } catch (err) {
    return { error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main CLI streamer
// ---------------------------------------------------------------------------
interface UIMessagePart {
  role: string;
  parts: { type: string; text?: string }[];
}

export function streamFromCLI(
  messages: UIMessagePart[],
  toolset: string,
  context: Record<string, unknown>,
  sessionId?: string,
): Response {
  const { system, toolPrompt, tools } = loadToolset(toolset, context);
  const cli = process.env.AI_CLI_COMMAND ?? 'claude';

  // Extract just the latest user message text
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUser?.parts
    ?.filter((p: { type: string }) => p.type === 'text')
    .map((p: { text?: string }) => p.text)
    .join('\n') ?? '';

  // When there's no session, we need to include history in the prompt
  let prompt: string;
  if (!sessionId) {
    const historyLines: string[] = [];
    for (const msg of messages.slice(0, -1)) {
      const text = msg.parts
        ?.filter((p: { type: string }) => p.type === 'text')
        .map((p: { text?: string }) => p.text)
        .join('\n') ?? '';
      if (text) {
        historyLines.push(`[${msg.role === 'user' ? 'User' : 'Assistant'}]: ${text}`);
      }
    }
    prompt = historyLines.length > 0
      ? `Previous conversation:\n${historyLines.join('\n')}\n\nUser: ${userText}`
      : userText;
  } else {
    // Session mode — CLI manages history, only send latest message
    prompt = userText;
  }

  // Compose system prompt with tool instructions
  const fullSystem = [system, toolPrompt].filter(Boolean).join('\n\n---\n\n');

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose', // required by Claude Code when combining -p + stream-json
    '--include-partial-messages',
    // Disable CLI built-in tools (Read, Bash, etc.) — our custom tools
    // are embedded in the system prompt using <tool> tags instead.
    '--tools', '',
  ];

  // Session management: first turn creates with --session-id, subsequent
  // turns continue with --resume (CLI rejects reusing --session-id).
  if (sessionId) {
    const hasHistory = messages.some(m => m.role === 'assistant');
    if (hasHistory) {
      args.push('--resume', sessionId);
    } else {
      args.push('--session-id', sessionId);
    }
  } else {
    args.push('--no-session-persistence');
  }

  if (fullSystem) {
    args.push('--system-prompt', fullSystem);
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let textPartId = generateId();
      let started = false;
      const parser = new ToolCallParser();

      const startText = () => {
        if (!started) {
          writer.write({ type: 'text-start', id: textPartId });
          started = true;
        }
      };

      const endText = () => {
        if (started) {
          writer.write({ type: 'text-end', id: textPartId });
          started = false;
        }
      };

      const emitText = (text: string) => {
        startText();
        writer.write({ type: 'text-delta', id: textPartId, delta: text });
      };

      const processEvents = async (events: ToolCallParserEvent[]) => {
        for (const evt of events) {
          if (evt.type === 'text' && evt.text) {
            emitText(evt.text);
          } else if (evt.type === 'tool-call' && evt.toolName && evt.input) {
            // End any open text part before emitting tool events
            endText();

            const toolCallId = generateId();

            // Emit tool-input-available (dynamic — tools aren't registered on the client)
            writer.write({
              type: 'tool-input-available',
              toolCallId,
              toolName: evt.toolName,
              input: evt.input,
              dynamic: true,
            });

            // Execute tool and emit result
            const result = await executeTool(
              tools as Record<string, { execute?: (args: Record<string, unknown>) => Promise<unknown> }>,
              evt.toolName,
              evt.input,
            );

            // Emit tool-output-available
            writer.write({
              type: 'tool-output-available',
              toolCallId,
              output: result,
              dynamic: true,
            });

            // Start a new text part for any following text
            textPartId = generateId();
          }
        }
      };

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(cli, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, CLAUDECODE: '' },
        });

        proc.stdin.write(prompt);
        proc.stdin.end();

        let buffer = '';
        // With --include-partial-messages, each assistant event contains the
        // FULL cumulative text for each content block (not a delta). We track
        // per-block-index — a shared counter breaks when the model emits
        // multiple blocks (e.g. [text, tool_use, text]) because block 2's
        // shorter cumulative length would look "already emitted" relative to
        // block 0's length, and we'd skip its contents entirely.
        const emittedTextLenByIndex = new Map<number, number>();
        // Capture stderr so CLI failures aren't opaque ("exited with code 1").
        let stderrBuf = '';

        const processLine = async (line: string) => {
          if (!line.trim()) return;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'assistant' && evt.message?.content) {
              const blocks = evt.message.content as Array<{ type: string; text?: string }>;
              for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
                if (block.type === 'text' && typeof block.text === 'string') {
                  // Only feed the delta (new chars since last event) — tracked
                  // per block index so multi-block responses work correctly.
                  const prev = emittedTextLenByIndex.get(i) ?? 0;
                  if (block.text.length > prev) {
                    const delta = block.text.slice(prev);
                    emittedTextLenByIndex.set(i, block.text.length);
                    const events = parser.feed(delta);
                    await processEvents(events);
                  }
                }
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        };

        proc.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            processLine(line);
          }
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          stderrBuf += chunk.toString();
        });

        proc.on('close', async (code) => {
          // Flush remaining buffer
          if (buffer.trim()) {
            await processLine(buffer);
          }

          // Flush parser
          const remaining = parser.flush();
          await processEvents(remaining);

          endText();

          if (code && code !== 0) {
            const stderr = stderrBuf.trim();
            const tail = stderr ? stderr.slice(-800) : '(no stderr)';
            console.error(`[ai/chat:cli] ${cli} exited ${code}. stderr tail:\n${tail}`);
            reject(new Error(`CLI exited with code ${code}: ${tail || '(no stderr)'}`));
          } else {
            resolve();
          }
        });

        proc.on('error', reject);
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
