/**
 * Hudson AI provider — re-exports from @arach/ai.
 *
 * The canonical inference module lives in @arach/ai.
 * This file provides the Hudson-specific interface.
 */

export {
  resolveModel,
  availableProviders,
  loadCredentials,
  clearCredentialCache,
  DEFAULT_MODELS,
  infer,
  inferJSON,
} from '@arach/ai';

export type { ProviderName, InferOptions, InferResult } from '@arach/ai';
