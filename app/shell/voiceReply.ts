'use client';

import type { UIMessage } from 'ai';

export type HudsonSpokenReplyStyle = 'brief' | 'full';

const MAX_BRIEF_SENTENCES = 2;
const MAX_FULL_SENTENCES = 4;
const MAX_BRIEF_CHARS = 220;
const MAX_FULL_CHARS = 560;

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
  if (joined.length <= maxChars) {
    return ensureTerminalPunctuation(joined);
  }

  return ensureTerminalPunctuation(truncateAtWord(joined, maxChars));
}

export function getHudsonMessageDisplayText(message: Pick<UIMessage, 'parts'>): string {
  const text = (message.parts ?? [])
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');

  return collapseWhitespace(stripThinkBlocks(text));
}

export function createHudsonSpokenReply(
  text: string,
  style: HudsonSpokenReplyStyle,
): string {
  const cleaned = stripMarkdown(stripThinkBlocks(text));
  if (!cleaned) return '';

  if (style === 'full') {
    return collectSentences(cleaned, MAX_FULL_SENTENCES, MAX_FULL_CHARS);
  }

  return collectSentences(cleaned, MAX_BRIEF_SENTENCES, MAX_BRIEF_CHARS);
}
