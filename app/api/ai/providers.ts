/**
 * Hudson AI provider — re-exports from @arach/infer.
 *
 * The canonical inference module lives in @arach/infer.
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
} from '@arach/infer';

export type { ProviderName, InferOptions, InferResult } from '@arach/infer';
