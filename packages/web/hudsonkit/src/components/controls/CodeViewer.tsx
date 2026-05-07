'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, FileCode2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodeLanguage = 'typescript' | 'javascript' | 'json' | 'css' | 'html' | 'shell' | 'plain';

export interface CodeViewerProps {
  code: string;
  language?: CodeLanguage;
  filename?: string;
  startLine?: number;
  highlightLines?: number[];
  maxHeight?: string | number;
  showCopy?: boolean;
  showLineNumbers?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Token types for syntax highlighting
// ---------------------------------------------------------------------------

type TokenType =
  | 'keyword'
  | 'type'
  | 'string'
  | 'template'
  | 'comment'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'function'
  | 'property'
  | 'constant'
  | 'tag'
  | 'attr'
  | 'plain';

interface Token {
  type: TokenType;
  value: string;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const TS_KEYWORDS = new Set([
  'import', 'export', 'from', 'default', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'new', 'this', 'class', 'extends', 'implements', 'interface',
  'type', 'enum', 'namespace', 'module', 'declare', 'abstract', 'async',
  'await', 'yield', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
  'in', 'of', 'as', 'is', 'keyof', 'readonly', 'private', 'protected', 'public',
  'static', 'override', 'get', 'set', 'satisfies',
]);

const TS_CONSTANTS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'void']);

const TS_TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'never', 'unknown', 'object', 'symbol',
  'bigint', 'Array', 'Promise', 'Record', 'Partial', 'Required', 'Readonly',
  'Pick', 'Omit', 'Exclude', 'Extract', 'React', 'ReactNode', 'FC',
]);

function tokenizeTS(code: string): Token[][] {
  const lines = code.split('\n');
  let inBlockComment = false;

  return lines.map(line => {
    const tokens: Token[] = [];
    let i = 0;

    while (i < line.length) {
      if (inBlockComment) {
        const end = line.indexOf('*/', i);
        if (end === -1) {
          tokens.push({ type: 'comment', value: line.slice(i) });
          i = line.length;
        } else {
          tokens.push({ type: 'comment', value: line.slice(i, end + 2) });
          i = end + 2;
          inBlockComment = false;
        }
        continue;
      }

      // Line comment
      if (line[i] === '/' && line[i + 1] === '/') {
        tokens.push({ type: 'comment', value: line.slice(i) });
        break;
      }

      // Block comment start
      if (line[i] === '/' && line[i + 1] === '*') {
        const end = line.indexOf('*/', i + 2);
        if (end === -1) {
          tokens.push({ type: 'comment', value: line.slice(i) });
          inBlockComment = true;
          break;
        } else {
          tokens.push({ type: 'comment', value: line.slice(i, end + 2) });
          i = end + 2;
        }
        continue;
      }

      // Template string
      if (line[i] === '`') {
        let j = i + 1;
        while (j < line.length && line[j] !== '`') {
          if (line[j] === '\\') j++;
          j++;
        }
        tokens.push({ type: 'template', value: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }

      // String
      if (line[i] === '"' || line[i] === "'") {
        const quote = line[i];
        let j = i + 1;
        while (j < line.length && line[j] !== quote) {
          if (line[j] === '\\') j++;
          j++;
        }
        tokens.push({ type: 'string', value: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }

      // Number
      if (/\d/.test(line[i]) && (i === 0 || !/\w/.test(line[i - 1]))) {
        let j = i;
        while (j < line.length && /[\d.xXa-fA-F_n]/.test(line[j])) j++;
        tokens.push({ type: 'number', value: line.slice(i, j) });
        i = j;
        continue;
      }

      // Word (identifier/keyword)
      if (/[a-zA-Z_$@]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[\w$]/.test(line[j])) j++;
        const word = line.slice(i, j);
        const nextChar = line[j];

        if (TS_KEYWORDS.has(word)) {
          tokens.push({ type: 'keyword', value: word });
        } else if (TS_CONSTANTS.has(word)) {
          tokens.push({ type: 'constant', value: word });
        } else if (TS_TYPES.has(word) || (word[0] === word[0].toUpperCase() && /[a-z]/.test(word.slice(1)))) {
          tokens.push({ type: 'type', value: word });
        } else if (nextChar === '(') {
          tokens.push({ type: 'function', value: word });
        } else {
          tokens.push({ type: 'plain', value: word });
        }
        i = j;
        continue;
      }

      // Operators
      if (/[=<>!&|+\-*/%^~?:]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[=<>!&|+\-*/%^~?:]/.test(line[j])) j++;
        tokens.push({ type: 'operator', value: line.slice(i, j) });
        i = j;
        continue;
      }

      // Punctuation
      if (/[{}()\[\],;.]/.test(line[i])) {
        tokens.push({ type: 'punctuation', value: line[i] });
        i++;
        continue;
      }

      // Whitespace and other
      let j = i;
      while (j < line.length && !/[a-zA-Z_$@\d"'`/=<>!&|+\-*/%^~?:{}()\[\],;.]/.test(line[j])) j++;
      tokens.push({ type: 'plain', value: line.slice(i, j || i + 1) });
      i = j || i + 1;
    }

    return tokens;
  });
}

function tokenizeJSON(code: string): Token[][] {
  const lines = code.split('\n');
  return lines.map(line => {
    const tokens: Token[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') {
          if (line[j] === '\\') j++;
          j++;
        }
        const str = line.slice(i, j + 1);
        const isKey = line.slice(j + 1).trimStart().startsWith(':');
        tokens.push({ type: isKey ? 'property' : 'string', value: str });
        i = j + 1;
      } else if (/\d/.test(line[i]) || (line[i] === '-' && /\d/.test(line[i + 1] || ''))) {
        let j = i;
        if (line[j] === '-') j++;
        while (j < line.length && /[\d.eE+\-]/.test(line[j])) j++;
        tokens.push({ type: 'number', value: line.slice(i, j) });
        i = j;
      } else if (line.slice(i, i + 4) === 'true' || line.slice(i, i + 5) === 'false' || line.slice(i, i + 4) === 'null') {
        const word = line.slice(i).match(/^(true|false|null)/)![0];
        tokens.push({ type: 'constant', value: word });
        i += word.length;
      } else if (/[{}[\],:]/.test(line[i])) {
        tokens.push({ type: 'punctuation', value: line[i] });
        i++;
      } else {
        let j = i;
        while (j < line.length && !/["{}[\],:0-9\-]/.test(line[j]) && line.slice(j, j + 4) !== 'true' && line.slice(j, j + 5) !== 'false' && line.slice(j, j + 4) !== 'null') j++;
        if (j > i) tokens.push({ type: 'plain', value: line.slice(i, j) });
        else { tokens.push({ type: 'plain', value: line[i] }); i++; continue; }
        i = j;
      }
    }
    return tokens;
  });
}

function tokenizePlain(code: string): Token[][] {
  return code.split('\n').map(line => [{ type: 'plain' as const, value: line }]);
}

function tokenize(code: string, language: CodeLanguage): Token[][] {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'css':
    case 'html':
    case 'shell':
      return tokenizeTS(code);
    case 'json':
      return tokenizeJSON(code);
    default:
      return tokenizePlain(code);
  }
}

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: 'text-cyan-300',
  type: 'text-cyan-300',
  string: 'text-emerald-300',
  template: 'text-emerald-300/80',
  comment: 'text-white/25 italic',
  number: 'text-amber-300',
  operator: 'text-white/50',
  punctuation: 'text-white/40',
  function: 'text-blue-300',
  property: 'text-sky-200',
  constant: 'text-amber-200',
  tag: 'text-red-300',
  attr: 'text-orange-200',
  plain: 'text-white/80',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language = 'typescript',
  filename,
  startLine = 1,
  highlightLines,
  maxHeight,
  showCopy = true,
  showLineNumbers = true,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);
  const highlightSet = useMemo(() => new Set(highlightLines ?? []), [highlightLines]);

  const tokenizedLines = useMemo(() => tokenize(code, language), [code, language]);

  const lineCount = tokenizedLines.length;
  const gutterWidth = Math.max(3, String(startLine + lineCount - 1).length);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={`rounded-sm border border-white/[0.06] bg-[#0d0d0d] overflow-hidden ${className ?? ''}`}>
      {/* Header */}
      {(filename || showCopy) && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
          {filename && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <FileCode2 size={11} className="text-white/30 shrink-0" />
              <span className="text-[11px] font-mono text-white/50 truncate">{filename}</span>
            </div>
          )}
          {!filename && <div className="flex-1" />}
          {showCopy && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-white/30 hover:text-white/60 transition-colors shrink-0"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      )}

      {/* Code area */}
      <pre
        ref={codeRef}
        className="overflow-auto font-mono text-[12px] leading-[1.6]"
        style={{ maxHeight: maxHeight ?? 'none' }}
      >
        <code>
          {tokenizedLines.map((lineTokens, idx) => {
            const lineNum = startLine + idx;
            const isHighlighted = highlightSet.has(lineNum);
            return (
              <div
                key={idx}
                className={`flex ${isHighlighted ? 'bg-cyan-400/[0.06] border-l-2 border-l-cyan-400/40' : 'border-l-2 border-l-transparent'}`}
              >
                {showLineNumbers && (
                  <span className="shrink-0 select-none text-right text-white/15 pr-4 pl-3 py-px" style={{ width: `${gutterWidth + 3}ch` }}>
                    {lineNum}
                  </span>
                )}
                <span className={`flex-1 pr-4 py-px ${!showLineNumbers ? 'pl-3' : ''}`}>
                  {lineTokens.length === 0 && '\n'}
                  {lineTokens.map((token, ti) => (
                    <span key={ti} className={TOKEN_COLORS[token.type]}>
                      {token.value}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
};
