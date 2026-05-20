'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Eye, EyeOff, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ServiceActionButton } from '../apps/hudson-docs/components';

type LocalEnvironmentEntry = {
  key: string;
  value: string;
  maskedValue: string;
  source: 'vault' | 'env';
  sensitive: boolean;
  hasValue: boolean;
};

type LocalEnvironmentStore = {
  path: string;
  vaultPath: string;
  vaultKeyStorage: 'env' | 'macos-keychain' | 'file';
  entries: LocalEnvironmentEntry[];
  suggestedKeys: string[];
};

function describeVaultKeyStorage(storage: LocalEnvironmentStore['vaultKeyStorage'] | undefined) {
  switch (storage) {
    case 'macos-keychain':
      return 'macOS Keychain';
    case 'env':
      return 'HUDSON_LOCAL_VAULT_KEY';
    case 'file':
      return 'local 0600 key file';
    default:
      return 'local key store';
  }
}

export function HudsonEnvironmentEditor({
  intro,
}: {
  intro?: ReactNode;
}) {
  const [environmentStore, setEnvironmentStore] = useState<LocalEnvironmentStore | null>(null);
  const [environmentDrafts, setEnvironmentDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [environmentStatus, setEnvironmentStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [activeEnvironmentKey, setActiveEnvironmentKey] = useState<string | null>(null);

  const syncEnvironmentStore = useCallback((store: LocalEnvironmentStore) => {
    setEnvironmentStore(store);
    setEnvironmentDrafts(Object.fromEntries(
      store.entries.map(entry => [entry.key, entry.source === 'vault' ? '' : entry.value]),
    ));
  }, []);

  const loadEnvironment = useCallback(async () => {
    setEnvironmentStatus('loading');

    try {
      const response = await fetch('/api/settings/environment', {
        cache: 'no-store',
      });
      const data = await response.json() as LocalEnvironmentStore & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || `Failed to load local environment (${response.status}).`);
      }

      syncEnvironmentStore(data);
      setEnvironmentError(null);
    } catch (error) {
      setEnvironmentError(error instanceof Error ? error.message : 'Failed to load local environment.');
    } finally {
      setEnvironmentStatus('idle');
    }
  }, [syncEnvironmentStore]);

  useEffect(() => {
    void loadEnvironment();
  }, [loadEnvironment]);

  const handleSaveEnvironmentValue = useCallback(async (key: string, value: string) => {
    const entry = environmentStore?.entries.find(item => item.key === key);
    if (entry?.source === 'vault' && value.length === 0) {
      setEnvironmentError(`Enter a replacement value for ${key}; vaulted secrets are not revealed back into the editor.`);
      return false;
    }

    setActiveEnvironmentKey(key);
    setEnvironmentStatus('saving');

    try {
      const response = await fetch('/api/settings/environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value,
        }),
      });
      const data = await response.json() as LocalEnvironmentStore & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || `Failed to save ${key} (${response.status}).`);
      }

      syncEnvironmentStore(data);
      setEnvironmentError(null);
      return true;
    } catch (error) {
      setEnvironmentError(error instanceof Error ? error.message : `Failed to save ${key}.`);
      return false;
    } finally {
      setActiveEnvironmentKey(null);
      setEnvironmentStatus('idle');
    }
  }, [environmentStore?.entries, syncEnvironmentStore]);

  const handleDeleteEnvironmentValue = useCallback(async (key: string) => {
    setActiveEnvironmentKey(key);
    setEnvironmentStatus('saving');

    try {
      const response = await fetch('/api/settings/environment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await response.json() as LocalEnvironmentStore & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || `Failed to delete ${key} (${response.status}).`);
      }

      syncEnvironmentStore(data);
      setVisibleKeys(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setEnvironmentError(null);
    } catch (error) {
      setEnvironmentError(error instanceof Error ? error.message : `Failed to delete ${key}.`);
    } finally {
      setActiveEnvironmentKey(null);
      setEnvironmentStatus('idle');
    }
  }, [syncEnvironmentStore]);

  const handleCreateEnvironmentValue = useCallback(async () => {
    const key = newKey.trim();
    if (!key) {
      setEnvironmentError('Enter an environment variable name before saving.');
      return;
    }

    const didSave = await handleSaveEnvironmentValue(key, newValue);
    if (didSave) {
      setNewKey('');
      setNewValue('');
    }
  }, [handleSaveEnvironmentValue, newKey, newValue]);

  const entries = environmentStore?.entries ?? [];
  const suggestedKeys = environmentStore?.suggestedKeys ?? [];

  return (
    <div className="space-y-4">
      {intro && (
        <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
          {intro}
        </div>
      )}
      <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
        Hudson stores API keys and tokens in the encrypted local vault at <span className="text-foreground/80">{environmentStore?.vaultPath ?? '.data/hudson-local-vault.json'}</span>.
        The vault key is held by <span className="text-foreground/80">{describeVaultKeyStorage(environmentStore?.vaultKeyStorage)}</span>.
        Non-secret runtime variables stay in <span className="text-foreground/80">{environmentStore?.path ?? '.env.local'}</span>.
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-3 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Add Variable
        </div>
        <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
          Suggested API keys are saved to the vault. Values like <span className="text-foreground/75">AI_DEFAULT_MODE</span> remain in .env.local.
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            type="text"
            value={newKey}
            onChange={event => setNewKey(event.target.value)}
            placeholder="VARIABLE_NAME"
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/70 focus:border-accent/50 focus:outline-none transition-colors xl:w-[240px]"
            spellCheck={false}
            autoComplete="off"
          />
          <input
            type="password"
            value={newValue}
            onChange={event => setNewValue(event.target.value)}
            placeholder="value"
            className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/70 focus:border-accent/50 focus:outline-none transition-colors"
            spellCheck={false}
            autoComplete="off"
          />
          <ServiceActionButton
            label="Save"
            loading={environmentStatus === 'saving' && activeEnvironmentKey === newKey.trim()}
            onClick={() => {
              void handleCreateEnvironmentValue();
            }}
          />
        </div>
        {suggestedKeys.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestedKeys.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setNewKey(key)}
                className="rounded-full border border-info/20 bg-info/10 px-2.5 py-1 text-[10px] font-mono text-info hover:border-info/40 hover:bg-info/15 transition-colors"
              >
                {key}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Variables
          </div>
          <ServiceActionButton
            label={environmentStatus === 'loading' ? 'Refreshing' : 'Refresh'}
            variant="secondary"
            loading={environmentStatus === 'loading'}
            onClick={() => {
              void loadEnvironment();
            }}
          />
        </div>
        {entries.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-3 text-[10px] font-mono text-muted-foreground">
            {environmentStatus === 'loading'
              ? 'Loading local environment...'
              : 'No local environment variables are stored in Hudson yet.'}
          </div>
        )}
        {entries.map(entry => {
          const isActive = activeEnvironmentKey === entry.key;
          const isVisible = visibleKeys[entry.key] ?? false;
          const isVaulted = entry.source === 'vault';
          const saveLabel = isVaulted
            ? 'Replace'
            : entry.sensitive
              ? 'Move to Vault'
              : 'Save';

          return (
            <div
              key={entry.key}
              className="rounded-lg border border-border/60 bg-background/60 px-3 py-3"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                <div className="xl:w-[220px] xl:shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[12px] font-mono text-foreground">{entry.key}</div>
                    <div className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono ${
                      isVaulted
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                        : entry.sensitive
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-500'
                          : 'border-border bg-muted text-muted-foreground'
                    }`}>
                      {isVaulted ? <ShieldCheck size={9} /> : <FileText size={9} />}
                      {isVaulted ? 'vault' : '.env'}
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                    {entry.maskedValue || '(empty value)'}
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                    <input
                      type={isVaulted ? 'password' : isVisible ? 'text' : 'password'}
                      value={environmentDrafts[entry.key] ?? ''}
                      onChange={event => setEnvironmentDrafts(current => ({
                        ...current,
                        [entry.key]: event.target.value,
                      }))}
                      placeholder={isVaulted ? 'Enter replacement value' : undefined}
                      className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/70 focus:border-accent/50 focus:outline-none transition-colors"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <div className="flex items-center gap-2">
                      {isVaulted ? (
                        <div
                          className="p-2 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          title="Vaulted secrets are not revealed back into the browser"
                        >
                          <LockKeyhole size={12} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVisibleKeys(current => ({
                            ...current,
                            [entry.key]: !isVisible,
                          }))}
                          className="p-2 rounded border border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                          title={isVisible ? 'Hide value' : 'Reveal value'}
                        >
                          {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                      <ServiceActionButton
                        label={saveLabel}
                        loading={environmentStatus === 'saving' && isActive}
                        onClick={() => {
                          void handleSaveEnvironmentValue(entry.key, environmentDrafts[entry.key] ?? '');
                        }}
                      />
                      <ServiceActionButton
                        label="Delete"
                        variant="secondary"
                        loading={environmentStatus === 'saving' && isActive}
                        onClick={() => {
                          void handleDeleteEnvironmentValue(entry.key);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {environmentError && (
          <div className="text-[10px] font-mono text-warning">
            {environmentError}
          </div>
        )}
        <div className="text-[10px] font-mono text-muted-foreground">
          This editor manages Hudson&apos;s local vault plus <span className="text-foreground/80">.env.local</span> for the current repo.
        </div>
      </div>
    </div>
  );
}
