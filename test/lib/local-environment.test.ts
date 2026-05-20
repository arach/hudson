import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  isValidHudsonEnvKey,
  maskHudsonEnvValue,
  parseHudsonEnvFile,
  serializeHudsonEnvValue,
  updateHudsonEnvFile,
} from '@/app/lib/localEnvironment';
import {
  clearHudsonLocalSecretVaultCacheForTests,
  deleteHudsonLocalSecret,
  getHudsonLocalSecretVaultInfo,
  isHudsonSecretEnvKey,
  loadHudsonLocalSecrets,
  setHudsonLocalSecret,
} from '@/app/lib/localSecretVault';

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

  it('classifies provider credentials as vault-backed secrets', () => {
    expect(isHudsonSecretEnvKey('MINIMAX_API_KEY')).toBe(true);
    expect(isHudsonSecretEnvKey('OPENAI_API_KEY')).toBe(true);
    expect(isHudsonSecretEnvKey('AI_DEFAULT_MODE')).toBe(false);
  });
});

describe('Hudson local secret vault', () => {
  let tempDir: string;
  let originalVaultPath: string | undefined;
  let originalVaultKey: string | undefined;
  let originalVaultAccount: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hudson-vault-test-'));
    originalVaultPath = process.env.HUDSON_LOCAL_VAULT_PATH;
    originalVaultKey = process.env.HUDSON_LOCAL_VAULT_KEY;
    originalVaultAccount = process.env.HUDSON_LOCAL_VAULT_ACCOUNT;
    process.env.HUDSON_LOCAL_VAULT_PATH = join(tempDir, 'vault.json');
    process.env.HUDSON_LOCAL_VAULT_KEY = 'test-local-vault-key';
    process.env.HUDSON_LOCAL_VAULT_ACCOUNT = 'test-account';
    clearHudsonLocalSecretVaultCacheForTests();
  });

  afterEach(() => {
    if (originalVaultPath === undefined) delete process.env.HUDSON_LOCAL_VAULT_PATH;
    else process.env.HUDSON_LOCAL_VAULT_PATH = originalVaultPath;
    if (originalVaultKey === undefined) delete process.env.HUDSON_LOCAL_VAULT_KEY;
    else process.env.HUDSON_LOCAL_VAULT_KEY = originalVaultKey;
    if (originalVaultAccount === undefined) delete process.env.HUDSON_LOCAL_VAULT_ACCOUNT;
    else process.env.HUDSON_LOCAL_VAULT_ACCOUNT = originalVaultAccount;
    clearHudsonLocalSecretVaultCacheForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('roundtrips encrypted secrets without writing plaintext to disk', () => {
    setHudsonLocalSecret('MINIMAX_API_KEY', 'minimax-secret-token');

    expect(loadHudsonLocalSecrets().MINIMAX_API_KEY).toBe('minimax-secret-token');
    expect(getHudsonLocalSecretVaultInfo().keyStorage).toBe('env');

    const vaultPath = process.env.HUDSON_LOCAL_VAULT_PATH!;
    expect(existsSync(vaultPath)).toBe(true);
    expect(readFileSync(vaultPath, 'utf-8')).not.toContain('minimax-secret-token');

    deleteHudsonLocalSecret('MINIMAX_API_KEY');
    expect(loadHudsonLocalSecrets().MINIMAX_API_KEY).toBeUndefined();
  });
});
