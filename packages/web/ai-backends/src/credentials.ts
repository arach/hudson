// ---------------------------------------------------------------------------
// Credential resolution types
// ---------------------------------------------------------------------------

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
