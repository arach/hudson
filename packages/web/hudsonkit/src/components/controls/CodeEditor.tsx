'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, FileCode2 } from 'lucide-react';
import type { CodeLanguage } from './CodeViewer';
import { useOptionalTheme } from '../../theme/ThemeProvider';

export type DocumentLanguage = CodeLanguage | 'markdown';

export interface CodeEditorSelection {
  from: number;
  to: number;
  text: string;
}

export interface CodeEditorProps {
  code: string;
  language?: DocumentLanguage;
  filename?: string;
  onSave?: (content: string) => void | boolean | Promise<void | boolean>;
  onChange?: (content: string) => void;
  onSelectionChange?: (selection: CodeEditorSelection) => void;
  showLineNumbers?: boolean;
  readOnly?: boolean;
  className?: string;
}

type CodeMirrorExtension = unknown;
type CodeMirrorStateValue = unknown;
type CodeMirrorTag = unknown;

interface CodeMirrorStateLike {
  doc: { toString(): string; sliceString(from: number, to: number): string };
  selection: { main: { from: number; to: number } };
}

interface CodeMirrorViewLike {
  state: CodeMirrorStateLike;
  dispatch(spec: { changes: { from: number; to: number; insert: string } }): void;
  destroy(): void;
}

interface CodeMirrorUpdateLike {
  docChanged: boolean;
  selectionSet: boolean;
  state: CodeMirrorStateLike;
}

interface CodeMirrorKeyBinding {
  key?: string;
  preventDefault?: boolean;
  run?: (view: CodeMirrorViewLike) => boolean;
  shift?: (view: CodeMirrorViewLike) => boolean;
}

interface CodeMirrorFacet<T> {
  of(value: T): CodeMirrorExtension;
}

interface CodeMirrorTags {
  [name: string]: CodeMirrorTag | ((tag: CodeMirrorTag) => CodeMirrorTag);
  function: (tag: CodeMirrorTag) => CodeMirrorTag;
  constant: (tag: CodeMirrorTag) => CodeMirrorTag;
  standard: (tag: CodeMirrorTag) => CodeMirrorTag;
  definition: (tag: CodeMirrorTag) => CodeMirrorTag;
  special: (tag: CodeMirrorTag) => CodeMirrorTag;
}

interface CodeMirrorRuntime {
  defaultKeymap: CodeMirrorKeyBinding[];
  history: () => CodeMirrorExtension;
  historyKeymap: CodeMirrorKeyBinding[];
  indentWithTab: CodeMirrorKeyBinding;
  css: () => CodeMirrorExtension;
  html: () => CodeMirrorExtension;
  javascript: (options?: { jsx?: boolean; typescript?: boolean }) => CodeMirrorExtension;
  json: () => CodeMirrorExtension;
  markdown: () => CodeMirrorExtension;
  HighlightStyle: { define(specs: Array<Record<string, unknown>>): CodeMirrorExtension };
  bracketMatching: () => CodeMirrorExtension;
  defaultHighlightStyle: CodeMirrorExtension;
  foldGutter: () => CodeMirrorExtension;
  indentOnInput: () => CodeMirrorExtension;
  syntaxHighlighting: (style: CodeMirrorExtension, options?: { fallback?: boolean }) => CodeMirrorExtension;
  EditorState: {
    create(config: { doc: string; extensions: CodeMirrorExtension[] }): CodeMirrorStateValue;
    allowMultipleSelections: CodeMirrorFacet<boolean>;
    readOnly: CodeMirrorFacet<boolean>;
  };
  Prec: { highest(extension: CodeMirrorExtension): CodeMirrorExtension };
  EditorView: {
    new(config: { parent: HTMLElement; state: CodeMirrorStateValue }): CodeMirrorViewLike;
    theme(spec: Record<string, Record<string, string>>): CodeMirrorExtension;
    editable: CodeMirrorFacet<boolean>;
    lineWrapping: CodeMirrorExtension;
    updateListener: CodeMirrorFacet<(update: CodeMirrorUpdateLike) => void>;
  };
  crosshairCursor: () => CodeMirrorExtension;
  drawSelection: () => CodeMirrorExtension;
  dropCursor: () => CodeMirrorExtension;
  highlightActiveLine: () => CodeMirrorExtension;
  highlightActiveLineGutter: () => CodeMirrorExtension;
  highlightSpecialChars: () => CodeMirrorExtension;
  keymap: { of(bindings: CodeMirrorKeyBinding[]): CodeMirrorExtension };
  lineNumbers: () => CodeMirrorExtension;
  rectangularSelection: () => CodeMirrorExtension;
  tags: CodeMirrorTags;
}

let codeMirrorRuntimePromise: Promise<CodeMirrorRuntime> | null = null;

function asRuntimeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function loadCodeMirrorRuntime(): Promise<CodeMirrorRuntime> {
  if (!codeMirrorRuntimePromise) {
    codeMirrorRuntimePromise = Promise.all([
      import('@codemirror/commands'),
      import('@codemirror/lang-css'),
      import('@codemirror/lang-html'),
      import('@codemirror/lang-javascript'),
      import('@codemirror/lang-json'),
      import('@codemirror/lang-markdown'),
      import('@codemirror/language'),
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@lezer/highlight'),
    ]).then(([
      commands,
      cssModule,
      htmlModule,
      javascriptModule,
      jsonModule,
      markdownModule,
      languageModule,
      stateModule,
      viewModule,
      highlightModule,
    ]) => ({
      defaultKeymap: commands.defaultKeymap as unknown as CodeMirrorKeyBinding[],
      history: commands.history as unknown as () => CodeMirrorExtension,
      historyKeymap: commands.historyKeymap as unknown as CodeMirrorKeyBinding[],
      indentWithTab: commands.indentWithTab as unknown as CodeMirrorKeyBinding,
      css: cssModule.css as unknown as () => CodeMirrorExtension,
      html: htmlModule.html as unknown as () => CodeMirrorExtension,
      javascript: javascriptModule.javascript as unknown as CodeMirrorRuntime['javascript'],
      json: jsonModule.json as unknown as () => CodeMirrorExtension,
      markdown: markdownModule.markdown as unknown as () => CodeMirrorExtension,
      HighlightStyle: languageModule.HighlightStyle as unknown as CodeMirrorRuntime['HighlightStyle'],
      bracketMatching: languageModule.bracketMatching as unknown as () => CodeMirrorExtension,
      defaultHighlightStyle: languageModule.defaultHighlightStyle as unknown as CodeMirrorExtension,
      foldGutter: languageModule.foldGutter as unknown as () => CodeMirrorExtension,
      indentOnInput: languageModule.indentOnInput as unknown as () => CodeMirrorExtension,
      syntaxHighlighting: languageModule.syntaxHighlighting as unknown as CodeMirrorRuntime['syntaxHighlighting'],
      EditorState: stateModule.EditorState as unknown as CodeMirrorRuntime['EditorState'],
      Prec: stateModule.Prec as unknown as CodeMirrorRuntime['Prec'],
      EditorView: viewModule.EditorView as unknown as CodeMirrorRuntime['EditorView'],
      crosshairCursor: viewModule.crosshairCursor as unknown as () => CodeMirrorExtension,
      drawSelection: viewModule.drawSelection as unknown as () => CodeMirrorExtension,
      dropCursor: viewModule.dropCursor as unknown as () => CodeMirrorExtension,
      highlightActiveLine: viewModule.highlightActiveLine as unknown as () => CodeMirrorExtension,
      highlightActiveLineGutter: viewModule.highlightActiveLineGutter as unknown as () => CodeMirrorExtension,
      highlightSpecialChars: viewModule.highlightSpecialChars as unknown as () => CodeMirrorExtension,
      keymap: viewModule.keymap as unknown as CodeMirrorRuntime['keymap'],
      lineNumbers: viewModule.lineNumbers as unknown as () => CodeMirrorExtension,
      rectangularSelection: viewModule.rectangularSelection as unknown as () => CodeMirrorExtension,
      tags: highlightModule.tags as unknown as CodeMirrorTags,
    })).catch(error => {
      codeMirrorRuntimePromise = null;
      throw error;
    });
  }

  return codeMirrorRuntimePromise;
}

function createHudsonHighlightStyles(rt: CodeMirrorRuntime) {
  const { tags } = rt;
  const tag = (name: string) => tags[name] as CodeMirrorTag;

  const hudsonHighlightStyle = rt.HighlightStyle.define([
    { tag: tag('keyword'), color: '#67e8f9' },
    { tag: [tag('name'), tag('deleted'), tag('character'), tag('macroName')], color: '#e5e7eb' },
    { tag: [tag('propertyName'), tag('attributeName')], color: '#bae6fd' },
    { tag: [tag('processingInstruction'), tag('string'), tag('inserted')], color: '#6ee7b7' },
    { tag: [tags.function(tag('variableName')), tag('labelName')], color: '#93c5fd' },
    { tag: [tag('color'), tags.constant(tag('name')), tags.standard(tag('name'))], color: '#fcd34d' },
    { tag: [tags.definition(tag('name')), tag('separator')], color: '#f8fafc' },
    { tag: [tag('className'), tag('number'), tag('changed'), tag('annotation'), tag('modifier')], color: '#fbbf24' },
    { tag: [tag('typeName'), tag('namespace')], color: '#22d3ee' },
    { tag: [tag('operator'), tag('operatorKeyword')], color: '#94a3b8' },
    { tag: [tag('url'), tag('escape'), tag('regexp'), tag('link')], color: '#38bdf8' },
    { tag: tag('meta'), color: '#94a3b8' },
    { tag: tag('comment'), color: '#64748b', fontStyle: 'italic' },
    { tag: tag('strong'), fontWeight: '700' },
    { tag: tag('emphasis'), fontStyle: 'italic' },
    { tag: tag('heading'), color: '#f8fafc', fontWeight: '700' },
    { tag: tag('atom'), color: '#fcd34d' },
    { tag: tag('bool'), color: '#fcd34d' },
    { tag: tags.special(tag('variableName')), color: '#38bdf8' },
    { tag: tag('invalid'), color: '#f87171' },
  ]);

  // Light-mode highlight palette — drafting/linen friendly. Saturated-mid tones
  // rather than the neon/pastel stack used on dark, so syntax reads on cream.
  const hudsonHighlightStyleLight = rt.HighlightStyle.define([
    { tag: tag('keyword'), color: '#0e7490' },
    { tag: [tag('name'), tag('deleted'), tag('character'), tag('macroName')], color: '#1f2937' },
    { tag: [tag('propertyName'), tag('attributeName')], color: '#0369a1' },
    { tag: [tag('processingInstruction'), tag('string'), tag('inserted')], color: '#15803d' },
    { tag: [tags.function(tag('variableName')), tag('labelName')], color: '#1d4ed8' },
    { tag: [tag('color'), tags.constant(tag('name')), tags.standard(tag('name'))], color: '#b45309' },
    { tag: [tags.definition(tag('name')), tag('separator')], color: '#111827' },
    { tag: [tag('className'), tag('number'), tag('changed'), tag('annotation'), tag('modifier')], color: '#b45309' },
    { tag: [tag('typeName'), tag('namespace')], color: '#0e7490' },
    { tag: [tag('operator'), tag('operatorKeyword')], color: '#475569' },
    { tag: [tag('url'), tag('escape'), tag('regexp'), tag('link')], color: '#1d4ed8' },
    { tag: tag('meta'), color: '#64748b' },
    { tag: tag('comment'), color: '#94a3b8', fontStyle: 'italic' },
    { tag: tag('strong'), fontWeight: '700' },
    { tag: tag('emphasis'), fontStyle: 'italic' },
    { tag: tag('heading'), color: '#111827', fontWeight: '700' },
    { tag: tag('atom'), color: '#b45309' },
    { tag: tag('bool'), color: '#b45309' },
    { tag: tags.special(tag('variableName')), color: '#1d4ed8' },
    { tag: tag('invalid'), color: '#b91c1c' },
  ]);

  return { hudsonHighlightStyle, hudsonHighlightStyleLight };
}

function createHudsonEditorThemes(rt: CodeMirrorRuntime) {
  const hudsonEditorTheme = rt.EditorView.theme({
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
  const hudsonEditorThemeLight = rt.EditorView.theme({
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

  return { hudsonEditorTheme, hudsonEditorThemeLight };
}

function languageExtension(rt: CodeMirrorRuntime, language: CodeEditorProps['language']): CodeMirrorExtension {
  switch (language) {
    case 'javascript':
      return rt.javascript({ jsx: true });
    case 'typescript':
      return rt.javascript({ jsx: true, typescript: true });
    case 'json':
      return rt.json();
    case 'css':
      return rt.css();
    case 'html':
      return rt.html();
    case 'markdown':
      return rt.markdown();
    case 'shell':
    case 'plain':
    default:
      return [];
  }
}

function editorSetup(rt: CodeMirrorRuntime, showLineNumbers: boolean, isLight: boolean): CodeMirrorExtension[] {
  const { hudsonHighlightStyle, hudsonHighlightStyleLight } = createHudsonHighlightStyles(rt);

  return [
    rt.highlightSpecialChars(),
    rt.history(),
    showLineNumbers ? rt.lineNumbers() : [],
    showLineNumbers ? rt.foldGutter() : [],
    rt.drawSelection(),
    rt.dropCursor(),
    rt.EditorState.allowMultipleSelections.of(true),
    rt.indentOnInput(),
    rt.syntaxHighlighting(rt.defaultHighlightStyle, { fallback: true }),
    rt.syntaxHighlighting(isLight ? hudsonHighlightStyleLight : hudsonHighlightStyle),
    rt.bracketMatching(),
    rt.rectangularSelection(),
    rt.crosshairCursor(),
    rt.highlightActiveLine(),
    showLineNumbers ? rt.highlightActiveLineGutter() : [],
    rt.keymap.of([...rt.defaultKeymap, ...rt.historyKeymap, rt.indentWithTab]),
  ];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language = 'typescript',
  filename,
  onSave,
  onChange,
  onSelectionChange,
  showLineNumbers = true,
  readOnly = false,
  className,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CodeMirrorViewLike | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [value, setValue] = useState(code);
  const [savedValue, setSavedValue] = useState(code);
  const [runtime, setRuntime] = useState<CodeMirrorRuntime | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);

  // Read the active hudson theme so the editor's surface + syntax palette
  // matches the consumer (cream/linen on light, slate on dark). Provider may
  // be absent during SSR or in unwired previews — fall back to dark.
  const themeContext = useOptionalTheme();
  const isLight = themeContext?.resolvedTheme === 'light';

  useEffect(() => {
    let active = true;

    loadCodeMirrorRuntime()
      .then(nextRuntime => {
        if (!active) return;
        setRuntime(nextRuntime);
        setRuntimeError(null);
      })
      .catch(error => {
        if (!active) return;
        setRuntime(null);
        setRuntimeError(asRuntimeError(error));
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const extensions = useMemo<CodeMirrorExtension[] | null>(() => {
    if (!runtime) return null;
    const { hudsonEditorTheme, hudsonEditorThemeLight } = createHudsonEditorThemes(runtime);

    return [
      ...editorSetup(runtime, showLineNumbers, isLight),
      languageExtension(runtime, language),
      runtime.EditorView.editable.of(!readOnly),
      runtime.EditorState.readOnly.of(readOnly),
      isLight ? hudsonEditorThemeLight : hudsonEditorTheme,
      runtime.EditorView.lineWrapping,
      // eslint-disable-next-line react-hooks/refs -- ref is read inside a CodeMirror updateListener (invoked on editor changes, not during render); using a ref keeps the memoized extension set stable across onChange identity changes
      runtime.EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const next = update.state.doc.toString();
          setValue(next);
          onChangeRef.current?.(next);
        }
        if (update.docChanged || update.selectionSet) {
          const { from, to } = update.state.selection.main;
          onSelectionChangeRef.current?.({
            from,
            to,
            text: update.state.doc.sliceString(from, to),
          });
        }
      }),
      // eslint-disable-next-line react-hooks/refs -- ref is read inside a CodeMirror keymap handler (invoked on Mod-s, not during render); using a ref keeps the memoized extension set stable across onSave identity changes
      runtime.Prec.highest(runtime.keymap.of([{
        key: 'Mod-s',
        preventDefault: true,
        run(view) {
          const next = view.state.doc.toString();
          void Promise.resolve(onSaveRef.current?.(next)).then(saved => {
            if (saved !== false) setSavedValue(next);
          }).catch(() => {
            // The document host owns save-error presentation; keep this buffer dirty.
          });
          return true;
        },
      }])),
    ];
  }, [isLight, language, readOnly, runtime, showLineNumbers]);

  useEffect(() => {
    if (!hostRef.current || !runtime || !extensions) return;
    const initialDoc = viewRef.current?.state.doc.toString() ?? code;

    const view = new runtime.EditorView({
      parent: hostRef.current,
      state: runtime.EditorState.create({ doc: initialDoc, extensions }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [extensions, runtime]);

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
      {runtime ? (
        <div ref={hostRef} className="min-h-0 flex-1" />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center font-mono text-[11px] text-muted-foreground">
          {runtimeError
            ? 'CodeEditor requires the optional CodeMirror peer dependencies (@codemirror/* and @lezer/highlight).'
            : 'Loading editor…'}
        </div>
      )}
    </div>
  );
};
