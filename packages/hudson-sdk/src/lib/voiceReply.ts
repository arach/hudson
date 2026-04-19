import type { UIMessage } from 'ai';
import type {
  VoiceSettings,
  SpokenReplyStyle,
  SpokenReplyLongResponse,
  SpokenReplyCodeResponse,
} from '../types/voice';

// ---------------------------------------------------------------------------
// Reply shaping — turns long, code-heavy, or markdown-rich assistant text
// into a sentence-bounded version suitable for speech synthesis.
// Lifted out of app/shell/voiceReply.ts so any SDK consumer can reuse it.
// ---------------------------------------------------------------------------

export type HudsonSpokenReplyStyle = SpokenReplyStyle;
export type HudsonVoiceBehaviorPreset = 'concise' | 'balanced' | 'detailed' | 'custom';

interface HudsonSpokenReplyPolicy {
  spokenReplyStyle: SpokenReplyStyle;
  spokenReplyLongResponse: SpokenReplyLongResponse;
  spokenReplyCodeResponse: SpokenReplyCodeResponse;
  spokenReplyMaxChars: number;
}

interface SpeechContentAnalysis {
  cleaned: string;
  proseOnly: string;
  codeHeavy: boolean;
}

const MAX_BRIEF_SENTENCES = 3;
const MAX_FULL_SENTENCES = 6;
const MAX_ADAPTIVE_SENTENCES = 4;
const MAX_BRIEF_CHARS = 320;
const MAX_FULL_CHARS = 760;
const MAX_ADAPTIVE_CHARS = 480;

const HUDSON_VOICE_BEHAVIOR_PRESETS = {
  concise: {
    spokenReplyStyle: 'brief',
    spokenReplyLongResponse: 'invite',
    spokenReplyCodeResponse: 'mention',
    spokenReplyMaxChars: 360,
  },
  balanced: {
    spokenReplyStyle: 'adaptive',
    spokenReplyLongResponse: 'invite',
    spokenReplyCodeResponse: 'summary',
    spokenReplyMaxChars: 720,
  },
  detailed: {
    spokenReplyStyle: 'full',
    spokenReplyLongResponse: 'summary',
    spokenReplyCodeResponse: 'summary',
    spokenReplyMaxChars: 960,
  },
} as const satisfies Record<
  Exclude<HudsonVoiceBehaviorPreset, 'custom'>,
  HudsonSpokenReplyPolicy
>;

const DEFAULT_SPOKEN_REPLY_POLICY: HudsonSpokenReplyPolicy = HUDSON_VOICE_BEHAVIOR_PRESETS.balanced;

export function getHudsonVoiceBehaviorPresetLabel(preset: HudsonVoiceBehaviorPreset): string {
  switch (preset) {
    case 'concise': return 'Concise';
    case 'balanced': return 'Balanced';
    case 'detailed': return 'Detailed';
    case 'custom':
    default: return 'Custom';
  }
}

export function getHudsonSpokenReplyStyleLabel(style: SpokenReplyStyle): string {
  switch (style) {
    case 'brief': return 'Concise';
    case 'adaptive': return 'Balanced';
    case 'full':
    default: return 'Detailed';
  }
}

export function applyHudsonVoiceBehaviorPreset(
  settings: VoiceSettings,
  preset: Exclude<HudsonVoiceBehaviorPreset, 'custom'>,
): VoiceSettings {
  return { ...settings, ...HUDSON_VOICE_BEHAVIOR_PRESETS[preset] };
}

export function getHudsonVoiceBehaviorPreset(
  settings: Pick<
    VoiceSettings,
    'spokenReplyStyle' | 'spokenReplyLongResponse' | 'spokenReplyCodeResponse' | 'spokenReplyMaxChars'
  >,
): HudsonVoiceBehaviorPreset {
  for (const [preset, config] of Object.entries(HUDSON_VOICE_BEHAVIOR_PRESETS) as Array<
    [Exclude<HudsonVoiceBehaviorPreset, 'custom'>, HudsonSpokenReplyPolicy]
  >) {
    if (
      settings.spokenReplyStyle === config.spokenReplyStyle
      && settings.spokenReplyLongResponse === config.spokenReplyLongResponse
      && settings.spokenReplyCodeResponse === config.spokenReplyCodeResponse
      && settings.spokenReplyMaxChars === config.spokenReplyMaxChars
    ) {
      return preset;
    }
  }
  return 'custom';
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, ' ');
}

function stripMarkdown(text: string): string {
  return collapseWhitespace(
    text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\|/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .replace(/\n/g, ' '),
  );
}

function splitSentences(text: string): string[] {
  return collapseWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars).trim();
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice;
  return trimmed.replace(/[,:; -]+$/, '').trim();
}

function ensureTerminalPunctuation(text: string): string {
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function collectSentences(text: string, maxSentences: number, maxChars: number): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return ensureTerminalPunctuation(truncateAtWord(collapseWhitespace(text), maxChars));
  }
  const selected: string[] = [];
  for (const sentence of sentences) {
    const next = collapseWhitespace([...selected, sentence].join(' '));
    if (selected.length > 0 && next.length > maxChars) break;
    selected.push(sentence);
    if (selected.length >= maxSentences) break;
  }
  if (selected.length === 0) {
    return ensureTerminalPunctuation(truncateAtWord(sentences[0] ?? text, maxChars));
  }
  const joined = collapseWhitespace(selected.join(' '));
  if (joined.length <= maxChars) return ensureTerminalPunctuation(joined);
  return ensureTerminalPunctuation(truncateAtWord(joined, maxChars));
}

function normalizeSpokenReplyPolicy(
  policy: VoiceSettings | HudsonSpokenReplyStyle,
): HudsonSpokenReplyPolicy {
  if (typeof policy === 'string') {
    return { ...DEFAULT_SPOKEN_REPLY_POLICY, spokenReplyStyle: policy };
  }
  return {
    spokenReplyStyle: policy.spokenReplyStyle ?? DEFAULT_SPOKEN_REPLY_POLICY.spokenReplyStyle,
    spokenReplyLongResponse: policy.spokenReplyLongResponse ?? DEFAULT_SPOKEN_REPLY_POLICY.spokenReplyLongResponse,
    spokenReplyCodeResponse: policy.spokenReplyCodeResponse ?? DEFAULT_SPOKEN_REPLY_POLICY.spokenReplyCodeResponse,
    spokenReplyMaxChars: policy.spokenReplyMaxChars ?? DEFAULT_SPOKEN_REPLY_POLICY.spokenReplyMaxChars,
  };
}

function getStyleLimits(style: SpokenReplyStyle) {
  switch (style) {
    case 'full': return { maxSentences: MAX_FULL_SENTENCES, maxChars: MAX_FULL_CHARS };
    case 'adaptive': return { maxSentences: MAX_ADAPTIVE_SENTENCES, maxChars: MAX_ADAPTIVE_CHARS };
    default: return { maxSentences: MAX_BRIEF_SENTENCES, maxChars: MAX_BRIEF_CHARS };
  }
}

function analyzeSpeechContent(rawText: string): SpeechContentAnalysis {
  const withoutThink = stripThinkBlocks(rawText);
  const fencedCodeBlocks = [...withoutThink.matchAll(/```[\s\S]*?```/g)];
  const inlineCodeMatches = [...withoutThink.matchAll(/`[^`]+`/g)];
  const proseWithoutCode = withoutThink
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, ' $1 ');

  const cleaned = stripMarkdown(withoutThink);
  const proseOnly = stripMarkdown(proseWithoutCode);
  const codeCharCount = fencedCodeBlocks.reduce((sum, match) => sum + match[0].length, 0)
    + inlineCodeMatches.reduce((sum, match) => sum + match[0].length, 0);
  const codeSignals = fencedCodeBlocks.length > 0
    || inlineCodeMatches.length >= 2
    || (codeCharCount > 120 && codeCharCount > cleaned.length * 0.18)
    || (/(const|let|function|class|interface|return|import|export)\s+/.test(withoutThink) && /[{}();]/.test(withoutThink));

  return { cleaned, proseOnly, codeHeavy: codeSignals };
}

function buildStandardSpokenReply(text: string, style: SpokenReplyStyle): string {
  const { maxSentences, maxChars } = getStyleLimits(style);
  return collectSentences(text, maxSentences, maxChars);
}

function buildCompactSummary(text: string): string {
  return collectSentences(text, 3, 260);
}

function buildLongReply(analysis: SpeechContentAnalysis, policy: HudsonSpokenReplyPolicy): string {
  switch (policy.spokenReplyLongResponse) {
    case 'summary':
      return buildCompactSummary(analysis.cleaned);
    case 'invite': {
      const intro = buildCompactSummary(analysis.cleaned);
      return collapseWhitespace(
        `${intro} The full details are in the written reply. We can talk through any part you want.`,
      );
    }
    case 'verbatim':
    default:
      return buildStandardSpokenReply(analysis.cleaned, policy.spokenReplyStyle);
  }
}

function buildCodeReply(analysis: SpeechContentAnalysis, policy: HudsonSpokenReplyPolicy): string {
  switch (policy.spokenReplyCodeResponse) {
    case 'read':
      return buildStandardSpokenReply(analysis.cleaned, policy.spokenReplyStyle);
    case 'mention':
      return 'I included code in the written reply. I can walk through the implementation if you want.';
    case 'summary':
    default: {
      const summarySource = analysis.proseOnly || analysis.cleaned;
      const summary = summarySource ? buildCompactSummary(summarySource) : '';
      if (summary) {
        return collapseWhitespace(
          `${summary} I also included code in the written reply. I can walk through the implementation if you want.`,
        );
      }
      return 'I included code in the written reply. I can walk through the implementation or focus on one piece if you want.';
    }
  }
}

export function getHudsonMessageDisplayText(message: Pick<UIMessage, 'parts'>): string {
  const text = (message.parts ?? [])
    .filter(part => part.type === 'text')
    .map(part => 'text' in part ? (part as { text?: string }).text ?? '' : '')
    .join('');
  return collapseWhitespace(stripThinkBlocks(text));
}

export function createHudsonSpokenReply(
  text: string,
  policy: VoiceSettings | HudsonSpokenReplyStyle,
): string {
  const resolvedPolicy = normalizeSpokenReplyPolicy(policy);
  const analysis = analyzeSpeechContent(text);
  if (!analysis.cleaned) return '';

  if (analysis.codeHeavy && resolvedPolicy.spokenReplyCodeResponse !== 'read') {
    return buildCodeReply(analysis, resolvedPolicy);
  }
  if (analysis.cleaned.length > resolvedPolicy.spokenReplyMaxChars
      && resolvedPolicy.spokenReplyLongResponse !== 'verbatim') {
    return buildLongReply(analysis, resolvedPolicy);
  }
  return buildStandardSpokenReply(analysis.cleaned, resolvedPolicy.spokenReplyStyle);
}
