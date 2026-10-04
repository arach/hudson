import type { ConversationConfig } from '../types';
import { validateGeminiLiveConfig, GEMINI_LIVE_PROVIDER_ID } from '../gemini-live';
import { validateGPTLiveConfig, buildGPTLiveDelegation, GPT_LIVE_PROVIDER_ID } from '../openai-live';
import { ConversationError } from '../types';

// ---------------------------------------------------------------------------
// Sample settings.
//
// AUTHORED configuration is what a host writes and this module validates —
// the executable entry point is `validateConversationSettings`. The
// saved-state sample below is ILLUSTRATIVE persistence only: it shows what a
// host might store, it is not a schema this package reads back.
// ---------------------------------------------------------------------------

/** Authored: GPT-Live with local tools delegated to a Responses backend. */
export const sampleGPTLiveSettings: ConversationConfig = {
  provider: GPT_LIVE_PROVIDER_ID,
  model: 'gpt-live-1',
  instructions: 'You are a concise spoken assistant.',
  voice: 'alloy',
  inputSampleRate: 24_000,
  options: { delegationModel: 'gpt-5.2' },
};

/** Authored: Gemini Live base model. */
export const sampleGeminiLiveSettings: ConversationConfig = {
  provider: GEMINI_LIVE_PROVIDER_ID,
  model: 'gemini-3.8-live',
  instructions: 'You are a concise spoken assistant.',
  voice: 'Kore',
  inputSampleRate: 16_000,
};

/** Authored: Gemini Live Extended Thinking with a reasoning level. */
export const sampleGeminiExtendedThinkingSettings: ConversationConfig = {
  provider: GEMINI_LIVE_PROVIDER_ID,
  model: 'gemini-3.8-live-extended-thinking',
  instructions: 'Narrate progress briefly while you work.',
  voice: 'Kore',
  inputSampleRate: 16_000,
  thinkingLevel: 'medium',
};

/**
 * ILLUSTRATIVE saved state: what a host's own persistence might look like
 * (its shape belongs to the host, not to this package). The credential is an
 * opaque reference into host storage — never a secret value.
 */
export const illustrativeSavedState = {
  version: 1,
  configuration: sampleGeminiLiveSettings,
  credentialReference: 'gemini-conversation-key',
  savedAt: '2026-09-16T00:00:00Z',
} as const;

/**
 * Validate an authored configuration with the same rules the connectors
 * enforce, plus delegation construction for GPT-Live. Returns human-readable
 * problems; an empty array means the connectors will accept the shape
 * (credentials and account access are still checked at connect time).
 */
export function validateConversationSettings(config: ConversationConfig): string[] {
  const problems: string[] = [];
  if (config.provider === GPT_LIVE_PROVIDER_ID) {
    const problem = validateGPTLiveConfig(config);
    if (problem) problems.push(problem);
    try {
      buildGPTLiveDelegation(config, []);
    } catch (error) {
      if (error instanceof ConversationError) problems.push(error.message);
    }
  } else if (config.provider === GEMINI_LIVE_PROVIDER_ID) {
    const problem = validateGeminiLiveConfig(config, []);
    if (problem) problems.push(problem);
  } else {
    problems.push(`Unknown conversation provider: ${config.provider}.`);
  }
  return problems;
}
