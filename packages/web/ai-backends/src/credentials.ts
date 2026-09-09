// ---------------------------------------------------------------------------
// Credential resolution types
// ---------------------------------------------------------------------------

import { getEnvApiKey } from '@earendil-works/pi-ai/compat';

/** Injected credential resolver — backends are credential-agnostic. */
export type CredentialResolver = (ctx: {
  provider: string;
  scope?: string;
}) => Promise<{ apiKey?: string; oauthToken?: string } | null>;

/**
 * Stub HudVault resolver. Returns null for all lookups until HudAI framework
 * lands and provides the real implementation.
 *
 * Apps can pass a custom resolver to adapter factories; this is the fallback.
 */
export const hudVaultResolver: CredentialResolver = async () => null;

/**
 * Environment-variable credential resolver. Resolves a provider's API key from
 * the process environment using pi-ai's own provider→env-var mapping (e.g.
 * `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`). This is the batteries-included
 * default for standalone hosts that keep keys in the environment — no vault, no
 * hand-rolled `process.env` lookups per app.
 *
 * Hosts that source keys elsewhere (a keychain, a secrets manager) can mirror
 * those into `process.env` first, or pass their own resolver instead.
 */
export const envCredentialResolver: CredentialResolver = async ({ provider }) => {
  const apiKey = getEnvApiKey(provider);
  return apiKey ? { apiKey } : null;
};
