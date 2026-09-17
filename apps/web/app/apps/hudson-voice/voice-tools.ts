import { createToolDispatcher, type ToolDeclaration } from '@hudsonkit/ai/conversation';

export const countWordsTool: ToolDeclaration = {
  name: 'count_words', description: 'Count the words in a piece of text.',
  parameters: { type: 'object', properties: { text: { type: 'string', description: 'Text to count words in.' } }, required: ['text'] },
  behavior: 'nonBlocking',
};
export function voiceDispatcher() {
  const dispatcher = createToolDispatcher({ authorize: call => call.name === countWordsTool.name });
  dispatcher.register(countWordsTool.name, async call => ({ words: (call.args as { text: string }).text.trim().split(/\s+/u).filter(Boolean).length }), {
    validate(call) {
      const args = call.args;
      if (!args || typeof args !== 'object' || Array.isArray(args)) return 'Expected an object with text.';
      const text = (args as Record<string, unknown>).text;
      return typeof text === 'string' && text.length <= 10_000 ? null : 'Text must be a string of at most 10000 characters.';
    },
  });
  return dispatcher;
}
