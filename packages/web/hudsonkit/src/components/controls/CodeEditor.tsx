'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import {
  HighlightStyle,
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, type Extension, Prec } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { Circle, FileCode2 } from 'lucide-react';
import type { CodeLanguage } from './CodeViewer';
import { useOptionalTheme } from '../../theme/ThemeProvider';

export type DocumentLanguage = CodeLanguage | 'markdown';

export interface CodeEditorProps {
  code: string;
  language?: DocumentLanguage;
  filename?: string;
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
  showLineNumbers?: boolean;
  readOnly?: boolean;
  className?: string;
}

const hudsonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#67e8f9' },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#e5e7eb' },
  { tag: [tags.propertyName, tags.attributeName], color: '#bae6fd' },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#6ee7b7' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: '#93c5fd' },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#fcd34d' },
  { tag: [tags.definition(tags.name), tags.separator], color: '#f8fafc' },
  { tag: [tags.className, tags.number, tags.changed, tags.annotation, tags.modifier], color: '#fbbf24' },
  { tag: [tags.typeName, tags.namespace], color: '#22d3ee' },
  { tag: [tags.operator, tags.operatorKeyword], color: '#94a3b8' },
  { tag: [tags.url, tags.escape, tags.regexp, tags.link], color: '#38bdf8' },
  { tag: tags.meta, color: '#94a3b8' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.heading, color: '#f8fafc', fontWeight: '700' },
  { tag: tags.atom, color: '#fcd34d' },
  { tag: tags.bool, color: '#fcd34d' },
  { tag: tags.special(tags.variableName), color: '#38bdf8' },
  { tag: tags.invalid, color: '#f87171' },
]);

// Light-mode highlight palette — drafting/linen friendly. Saturated-mid tones
// rather than the neon/pastel stack used on dark, so syntax reads on cream.
const hudsonHighlightStyleLight = HighlightStyle.define([
  { tag: tags.keyword, color: '#0e7490' },                       // cyan-700
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#1f2937' },
  { tag: [tags.propertyName, tags.attributeName], color: '#0369a1' }, // sky-700
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#15803d' }, // green-700
  { tag: [tags.function(tags.variableName), tags.labelName], color: '#1d4ed8' },       // blue-700
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#b45309' }, // amber-700
  { tag: [tags.definition(tags.name), tags.separator], color: '#111827' },
  { tag: [tags.className, tags.number, tags.changed, tags.annotation, tags.modifier], color: '#b45309' },
  { tag: [tags.typeName, tags.namespace], color: '#0e7490' },
  { tag: [tags.operator, tags.operatorKeyword], color: '#475569' }, // slate-600
  { tag: [tags.url, tags.escape, tags.regexp, tags.link], color: '#1d4ed8' },
  { tag: tags.meta, color: '#64748b' },
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.heading, color: '#111827', fontWeight: '700' },
  { tag: tags.atom, color: '#b45309' },
  { tag: tags.bool, color: '#b45309' },
  { tag: tags.special(tags.variableName), color: '#1d4ed8' },
  { tag: tags.invalid, color: '#b91c1c' },
]);

const hudsonEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: '#0a0f12',
    color: 'rgba(241, 245, 249, 0.86)',
    fontSize: '12px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '10px 0',
    caretColor: '#22d3ee',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    color: 'rgba(255, 255, 255, 0.18)',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 10px',
    minWidth: '34px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(34, 211, 238, 0.055)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    color: 'rgba(207, 250, 254, 0.72)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(14, 165, 233, 0.26)',
  },
  '.cm-cursor': {
    borderLeftColor: '#22d3ee',
  },
  '.cm-foldGutter span': {
    color: 'rgba(255, 255, 255, 0.24)',
  },
  '.cm-tooltip': {
    backgroundColor: '#0f1720',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.86)',
  },
});

// Light editor theme — driven by Tailwind CSS variables so the chrome reads
// on the linen / paper palette. Using `oklch(var(--background))` etc. keeps
// the editor in sync with the active consumer's cream/white surface.
const hudsonEditorThemeLight = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: 'oklch(var(--card) / 0.85)',
    color: 'oklch(var(--foreground) / 0.92)',
    fontSize: '12px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '10px 0',
    caretColor: '#0e7490',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-gutters': {
    backgroundColor: 'oklch(var(--muted) / 0.35)',
    color: 'oklch(var(--muted-foreground) / 0.7)',
    borderRight: '1px solid oklch(var(--border) / 0.6)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 10px',
    minWidth: '34px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(14, 116, 144, 0.05)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(14, 116, 144, 0.08)',
    color: 'oklch(var(--foreground) / 0.86)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(14, 116, 144, 0.18)',
  },
  '.cm-cursor': {
    borderLeftColor: '#0e7490',
  },
  '.cm-foldGutter span': {
    color: 'oklch(var(--muted-foreground) / 0.6)',
  },
  '.cm-tooltip': {
    backgroundColor: 'oklch(var(--popover))',
    border: '1px solid oklch(var(--border))',
    borderRadius: '6px',
    color: 'oklch(var(--popover-foreground))',
  },
});

function languageExtension(language: CodeEditorProps['language']): Extension {
  switch (language) {
    case 'javascript':
      return javascript({ jsx: true });
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'css':
      return css();
    case 'html':
      return html();
    case 'markdown':
      return markdown();
    case 'shell':
    case 'plain':
    default:
      return [];
  }
}

function editorSetup(showLineNumbers: boolean, isLight: boolean): Extension[] {
  return [
    highlightSpecialChars(),
    history(),
    showLineNumbers ? lineNumbers() : [],
    showLineNumbers ? foldGutter() : [],
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    syntaxHighlighting(isLight ? hudsonHighlightStyleLight : hudsonHighlightStyle),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    showLineNumbers ? highlightActiveLineGutter() : [],
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  ];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language = 'typescript',
  filename,
  onSave,
  onChange,
  showLineNumbers = true,
  readOnly = false,
  className,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const [value, setValue] = useState(code);
  const [savedValue, setSavedValue] = useState(code);

  // Read the active hudson theme so the editor's surface + syntax palette
  // matches the consumer (cream/linen on light, slate on dark). Provider may
  // be absent during SSR or in unwired previews — fall back to dark.
  const themeContext = useOptionalTheme();
  const isLight = themeContext?.resolvedTheme === 'light';

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const extensions = useMemo<Extension[]>(() => [
    ...editorSetup(showLineNumbers, isLight),
    languageExtension(language),
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),
    isLight ? hudsonEditorThemeLight : hudsonEditorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      const next = update.state.doc.toString();
      setValue(next);
      onChangeRef.current?.(next);
    }),
    Prec.highest(keymap.of([{
      key: 'Mod-s',
      preventDefault: true,
      run(view) {
        const next = view.state.doc.toString();
        onSaveRef.current?.(next);
        setSavedValue(next);
        return true;
      },
    }])),
  ], [isLight, language, readOnly, showLineNumbers]);

  useEffect(() => {
    if (!hostRef.current) return;
    const initialDoc = viewRef.current?.state.doc.toString() ?? code;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({ doc: initialDoc, extensions }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (code === current) return;

    view.dispatch({
      changes: { from: 0, to: current.length, insert: code },
    });
    setValue(code);
    setSavedValue(code);
  }, [code]);

  const isDirty = value !== savedValue;

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden ${className ?? ''}`}
      style={{ backgroundColor: isLight ? 'oklch(var(--card) / 0.85)' : '#0a0f12' }}
    >
      {filename && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <FileCode2 size={11} className="shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-[11px] text-foreground/72">{filename}</span>
          </div>
          {readOnly && (
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-cyan-700/70 dark:text-cyan-300/45">
              Read only
            </span>
          )}
          {isDirty && !readOnly && (
            <div className="flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-amber-700/80 dark:text-amber-400/70">
              <Circle size={6} fill="currentColor" />
              Modified
            </div>
          )}
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  );
};
