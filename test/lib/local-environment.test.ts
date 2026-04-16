import { describe, expect, it } from 'vitest';
import {
  isValidHudsonEnvKey,
  maskHudsonEnvValue,
  parseHudsonEnvFile,
  serializeHudsonEnvValue,
  updateHudsonEnvFile,
} from '@/app/lib/localEnvironment';

describe('Hudson local environment helpers', () => {
  it('validates environment variable names', () => {
    expect(isValidHudsonEnvKey('OPENAI_API_KEY')).toBe(true);
    expect(isValidHudsonEnvKey('_HUDSON_FLAG')).toBe(true);
    expect(isValidHudsonEnvKey('1_BAD_KEY')).toBe(false);
    expect(isValidHudsonEnvKey('bad-key')).toBe(false);
  });

  it('parses env files and preserves quoted values', () => {
    expect(parseHudsonEnvFile([
      '# Hudson local environment',
      'OPENAI_API_KEY="sk-openai"',
      'NOTIFY_EMAIL="ops@hudson.local"',
      'AI_CLI_COMMAND="codex --model gpt-5.4"',
    ].join('\n'))).toEqual({
      OPENAI_API_KEY: 'sk-openai',
      NOTIFY_EMAIL: 'ops@hudson.local',
      AI_CLI_COMMAND: 'codex --model gpt-5.4',
    });
  });

  it('serializes values for .env.local safely', () => {
    expect(serializeHudsonEnvValue('simple-token')).toBe('simple-token');
    expect(serializeHudsonEnvValue('codex --model gpt-5.4')).toBe('"codex --model gpt-5.4"');
    expect(parseHudsonEnvFile(`AI_CLI_COMMAND=${serializeHudsonEnvValue('codex --model gpt-5.4')}\n`))
      .toEqual({ AI_CLI_COMMAND: 'codex --model gpt-5.4' });
  });

  it('adds, updates, and deletes keys from env.local text', () => {
    const base = [
      'OPENAI_API_KEY=old-openai',
      'NOTIFY_EMAIL="ops@hudson.local"',
      '',
    ].join('\n');

    const updated = updateHudsonEnvFile(base, 'OPENAI_API_KEY', 'new-openai');
    expect(updated).toContain('OPENAI_API_KEY=new-openai');

    const appended = updateHudsonEnvFile(updated, 'AI_CLI_COMMAND', 'codex --model gpt-5.4');
    expect(appended).toContain('AI_CLI_COMMAND="codex --model gpt-5.4"');

    const emptied = updateHudsonEnvFile(appended, 'EMPTY_VALUE', '');
    expect(emptied).toContain('EMPTY_VALUE=""');

    const removed = updateHudsonEnvFile(emptied, 'NOTIFY_EMAIL', null);
    expect(removed).not.toContain('NOTIFY_EMAIL=');
    expect(parseHudsonEnvFile(removed)).toEqual({
      OPENAI_API_KEY: 'new-openai',
      AI_CLI_COMMAND: 'codex --model gpt-5.4',
      EMPTY_VALUE: '',
    });
  });

  it('masks environment values without exposing the full token', () => {
    expect(maskHudsonEnvValue('')).toBe('');
    expect(maskHudsonEnvValue('abcd1234')).toBe('ab••••34');
    expect(maskHudsonEnvValue('sk-proj-1234567890')).toBe('sk-p••••7890');
  });
});
