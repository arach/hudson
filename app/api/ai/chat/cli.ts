import { spawn } from 'child_process';
import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import { loadToolset } from '../toolsets';

interface UIMessagePart {
  role: string;
  parts: { type: string; text?: string }[];
}

export function streamFromCLI(
  messages: UIMessagePart[],
  toolset: string,
  context: Record<string, unknown>,
): Response {
  const { system } = loadToolset(toolset, context);
  const cli = process.env.AI_CLI_COMMAND ?? 'claude';

  // Build prompt from the last user message + system context
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUser?.parts
    ?.filter((p: { type: string }) => p.type === 'text')
    .map((p: { text?: string }) => p.text)
    .join('\n') ?? '';

  // Include conversation history for context
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

  const prompt = historyLines.length > 0
    ? `Previous conversation:\n${historyLines.join('\n')}\n\nUser: ${userText}`
    : userText;

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--no-session-persistence',
  ];

  if (system) {
    args.push('--system-prompt', system);
  }

  // Disable all tools — CLI mode is text feedback only
  args.push('--tools', '');

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const textPartId = generateId();
      let started = false;

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(cli, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, CLAUDECODE: '' },
        });

        proc.stdin.write(prompt);
        proc.stdin.end();

        let buffer = '';

        const emitText = (text: string) => {
          if (!started) {
            writer.write({ type: 'text-start', id: textPartId });
            started = true;
          }
          writer.write({ type: 'text-delta', id: textPartId, delta: text });
        };

        proc.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.type === 'assistant' && evt.message?.content) {
                for (const block of evt.message.content) {
                  if (block.type === 'text' && block.text) {
                    emitText(block.text);
                  }
                }
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        });

        proc.stderr.on('data', () => {
          // Ignore stderr
        });

        proc.on('close', (code) => {
          // Flush remaining buffer
          if (buffer.trim()) {
            try {
              const evt = JSON.parse(buffer);
              if (evt.type === 'assistant' && evt.message?.content) {
                for (const block of evt.message.content) {
                  if (block.type === 'text' && block.text) {
                    emitText(block.text);
                  }
                }
              }
            } catch {
              // ignore
            }
          }
          if (started) {
            writer.write({ type: 'text-end', id: textPartId });
          }
          if (code && code !== 0) {
            reject(new Error(`CLI exited with code ${code}`));
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
