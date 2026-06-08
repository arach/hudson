import type { FeatureFlagLocalState } from './types';

const VERSION = 1;

export function readFeatureFlagLocalState<TAudience extends string = string>(storageKey: string): FeatureFlagLocalState<TAudience> {
  if (typeof window === 'undefined') return { version: VERSION };
  try {
    const raw = window.localStorage?.getItem(storageKey);
    return parseFeatureFlagLocalState<TAudience>(raw);
  } catch {
    return { version: VERSION };
  }
}

export function writeFeatureFlagLocalState<TAudience extends string = string>(storageKey: string, state: FeatureFlagLocalState<TAudience>): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeLocalState(state);
  const body = JSON.stringify(normalized);
  try { window.localStorage?.setItem(storageKey, body); } catch {}
  writeCookie(storageKey, body);
}

export function parseFeatureFlagLocalState<TAudience extends string = string>(raw: string | null | undefined): FeatureFlagLocalState<TAudience> {
  if (!raw) return { version: VERSION };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { version: VERSION };
    return normalizeLocalState(parsed as FeatureFlagLocalState<TAudience>);
  } catch {
    return { version: VERSION };
  }
}

function normalizeLocalState<TAudience extends string>(state: FeatureFlagLocalState<TAudience>): FeatureFlagLocalState<TAudience> {
  const out: FeatureFlagLocalState<TAudience> = { version: VERSION };
  if (state.audience) out.audience = state.audience;
  if (state.flags && typeof state.flags === 'object') {
    out.flags = {};
    for (const [key, value] of Object.entries(state.flags)) {
      if (value === true || value === false) out.flags[key] = value;
    }
    if (Object.keys(out.flags).length === 0) delete out.flags;
  }
  return out;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  try {
    const encoded = encodeURIComponent(value);
    document.cookie = `${encodeURIComponent(name)}=${encoded}; Path=/; SameSite=Lax; Max-Age=31536000`;
  } catch {}
}
