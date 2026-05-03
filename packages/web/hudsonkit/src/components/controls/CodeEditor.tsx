'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, Circle } from 'lucide-react';
import type { CodeLanguage } from './CodeViewer';

// Re-use the tokenizer and color map from CodeViewer
// We duplicate the minimal subset here to keep the overlay self-contained.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeEditorProps {
  code: string;
  language?: CodeLanguage;
  filename?: string;
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
  showLineNumbers?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Token types (mirrored from CodeViewer)
// ---------------------------------------------------------------------------

type TokenType =
  | 'keyword' | 'type' | 'string' | 'template' | 'comment' | 'number'
  | 'operator' | 'punctuation' | 'function' | 'property' | 'constant'
  | 'tag' | 'attr' | 'plain';

interface Token { type: TokenType; value: string; }

// ---------------------------------------------------------------------------
// Tokenizer (same logic as CodeViewer)
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

      if (line[i] === '/' && line[i + 1] === '/') {
        tokens.push({ type: 'comment', value: line.slice(i) });
        break;
      }

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

      if (/\d/.test(line[i]) && (i === 0 || !/\w/.test(line[i - 1]))) {
        let j = i;
        while (j < line.length && /[\d.xXa-fA-F_n]/.test(line[j])) j++;
        tokens.push({ type: 'number', value: line.slice(i, j) });
        i = j;
        continue;
      }

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

      if (/[=<>!&|+\-*/%^~?:]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[=<>!&|+\-*/%^~?:]/.test(line[j])) j++;
        tokens.push({ type: 'operator', value: line.slice(i, j) });
        i = j;
        continue;
      }

      if (/[{}()\[\],;.]/.test(line[i])) {
        tokens.push({ type: 'punctuation', value: line[i] });
        i++;
        continue;
      }

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
// Color map (same as CodeViewer)
// ---------------------------------------------------------------------------

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: 'text-purple-300',
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
// Shared style constants
// ---------------------------------------------------------------------------

const FONT_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
  fontSize: '12px',
  lineHeight: '1.6',
  tabSize: 2,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language = 'typescript',
  filename,
  onSave,
  onChange,
  showLineNumbers = true,
  className,
}) => {
  const [value, setValue] = useState(code);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Sync external code prop changes
  useEffect(() => {
    setValue(code);
    setIsDirty(false);
  }, [code]);

  const tokenizedLines = useMemo(() => tokenize(value, language), [value, language]);

  const lineCount = tokenizedLines.length;
  const gutterWidth = Math.max(3, String(lineCount).length);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setIsDirty(newValue !== code);
    onChange?.(newValue);
  }, [code, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = value.slice(0, start) + '  ' + value.slice(end);
      setValue(newValue);
      setIsDirty(newValue !== code);
      onChange?.(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }

    // Cmd+S / Ctrl+S triggers save
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (onSave) {
        onSave(value);
        setIsDirty(false);
      }
    }
  }, [value, code, onChange, onSave]);

  // Sync scroll between textarea and highlight overlay + gutter
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    const pre = preRef.current;
    const gutter = gutterRef.current;
    if (!ta) return;
    if (pre) {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }
    if (gutter) {
      gutter.scrollTop = ta.scrollTop;
    }
  }, []);

  return (
    <div className={`bg-[#0d0d0d] overflow-hidden flex flex-col ${className ?? ''}`}>
      {/* Header (only if filename provided) */}
      {filename && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FileCode2 size={11} className="text-white/30 shrink-0" />
            <span className="text-[11px] font-mono text-white/50 truncate">{filename}</span>
          </div>
          {isDirty && (
            <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-amber-400/70 shrink-0">
              <Circle size={6} fill="currentColor" />
              Modified
            </div>
          )}
        </div>
      )}

      {/* Editor area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Line numbers gutter */}
        {showLineNumbers && (
          <div
            ref={gutterRef}
            className="shrink-0 overflow-hidden select-none border-r border-white/[0.04] bg-white/[0.01] py-2"
            style={{ width: `${gutterWidth + 3}ch`, ...FONT_STYLE }}
            aria-hidden
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="text-right text-white/15 pr-3 pl-2">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code container (overlay + textarea stacked) */}
        <div className="relative flex-1 min-w-0 overflow-auto">
          {/* Highlight overlay (rendered code — not interactive) */}
          <pre
            ref={preRef}
            className="absolute top-0 left-0 right-0 pointer-events-none m-0 p-0 py-2"
            style={FONT_STYLE}
            aria-hidden
          >
            <code className="block px-4 whitespace-pre">
              {tokenizedLines.map((lineTokens, idx) => (
                <div key={idx}>
                  {lineTokens.length === 0 ? ' \n' : lineTokens.map((token, ti) => (
                    <span key={ti} className={TOKEN_COLORS[token.type]}>
                      {token.value}
                    </span>
                  ))}
                </div>
              ))}
            </code>
          </pre>

          {/* Textarea (receives input — transparent text) */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            className="relative block w-full resize-none bg-transparent outline-none px-4 py-2 m-0 border-0 whitespace-pre"
            style={{
              ...FONT_STYLE,
              color: 'transparent',
              caretColor: 'rgb(34 211 238)',
              minHeight: `calc(${lineCount} * 1.6em + 16px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
