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
import { Compartment, EditorState, Prec, RangeSetBuilder, Transaction } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
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

type HudsonCodeMirrorPayload = {
  id?: string;
  title?: string;
  path?: string;
  language?: string;
  text?: string;
  readOnly?: boolean;
  tintHex?: string;
  embedded?: boolean;
};

type HudsonCodeMirrorMessage =
  | { type: 'ready' }
  | { type: 'change'; id?: string; text: string }
  | { type: 'save'; id?: string; text: string };

declare global {
  interface Window {
    __hudsonCodeMirror?: {
      setDocument: (payload: HudsonCodeMirrorPayload) => void;
      saveResult: (result: { id?: string; success: boolean; text?: string; error?: string }) => void;
      focus: () => void;
    };
    webkit?: {
      messageHandlers?: {
        hudsonCodeMirror?: {
          postMessage: (message: HudsonCodeMirrorMessage) => void;
        };
      };
    };
  }
}

const rootElement = document.getElementById('root');
const editorHost = document.getElementById('editor');
const titleElement = document.getElementById('title');
const badgeElement = document.getElementById('badge');
const statusElement = document.getElementById('status');

let view: EditorView | null = null;
let activePayload: HudsonCodeMirrorPayload = {};
let savedText = '';
let pendingSaveText: string | null = null;
let changeTimer: number | undefined;
let applyingDocument = false;
let mountedDocumentID: string | undefined;
let mountedLanguage = 'plain';
let mountedReadOnly = false;

const languageCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const historyCompartment = new Compartment();

function post(message: HudsonCodeMirrorMessage) {
  window.webkit?.messageHandlers?.hudsonCodeMirror?.postMessage(message);
}

function labelFor(payload: HudsonCodeMirrorPayload): string {
  return payload.title || payload.path?.split('/').pop() || 'Untitled';
}

function normalizedLanguage(language: string | undefined, path: string | undefined): string {
  const candidate = (language || path?.split('.').pop() || 'plain').toLowerCase();
  switch (candidate) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    default:
      return candidate;
  }
}

function languageExtension(language: string) {
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
    case 'swift':
      return swiftHighlightPlugin;
    default:
      return [];
  }
}

const swiftKeywords = new Set([
  'actor', 'any', 'as', 'associatedtype', 'async', 'await', 'break', 'case',
  'catch', 'class', 'continue', 'default', 'defer', 'do', 'else', 'enum',
  'extension', 'fallthrough', 'false', 'fileprivate', 'final', 'for', 'func',
  'guard', 'if', 'import', 'in', 'init', 'inout', 'internal', 'is', 'let',
  'nil', 'nonisolated', 'open', 'operator', 'override', 'private', 'protocol',
  'public', 'repeat', 'required', 'rethrows', 'return', 'self', 'Self',
  'some', 'static', 'struct', 'subscript', 'super', 'switch', 'throw',
  'throws', 'true', 'try', 'typealias', 'var', 'where', 'while',
]);

const swiftTokenPattern =
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|@\w+|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b/g;

function swiftTokenClass(token: string): string | null {
  if (token.startsWith('//') || token.startsWith('/*')) return 'cm-swift-comment';
  if (token.startsWith('"')) return 'cm-swift-string';
  if (token.startsWith('@')) return 'cm-swift-attribute';
  if (/^\d/.test(token)) return 'cm-swift-number';
  if (swiftKeywords.has(token)) return 'cm-swift-keyword';
  if (/^[A-Z]/.test(token)) return 'cm-swift-type';
  return null;
}

function buildSwiftDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to);
    swiftTokenPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = swiftTokenPattern.exec(text))) {
      const className = swiftTokenClass(match[0]);
      if (!className) continue;
      const from = range.from + match.index;
      builder.add(from, from + match[0].length, Decoration.mark({ class: className }));
    }
  }
  return builder.finish();
}

const swiftHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildSwiftDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSwiftDecorations(update.view);
      }
    }
  },
  {
    decorations: plugin => plugin.decorations,
  },
);

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

const hudsonEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    width: '100%',
    minHeight: '0',
    minWidth: '0',
    backgroundColor: '#0a0f12',
    color: 'rgba(241, 245, 249, 0.86)',
    fontSize: '12px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.6',
    height: '100%',
    minHeight: '0',
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  '.cm-content': {
    padding: '10px 0 18px',
    caretColor: '#22d3ee',
    minHeight: '100%',
  },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': {
    backgroundColor: '#0d1518',
    color: 'rgba(148, 163, 184, 0.62)',
    borderRight: '1px solid rgba(94, 234, 212, 0.12)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 14px',
    minWidth: '46px',
    textAlign: 'right',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(34, 211, 238, 0.055)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    color: 'rgba(207, 250, 254, 0.72)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(14, 165, 233, 0.26)',
  },
  '.cm-cursor': { borderLeftColor: '#22d3ee' },
  '.cm-foldGutter span': { color: 'rgba(255, 255, 255, 0.24)' },
  '.cm-swift-keyword': { color: '#67e8f9', fontWeight: '650' },
  '.cm-swift-type': { color: '#22d3ee' },
  '.cm-swift-string': { color: '#6ee7b7' },
  '.cm-swift-number': { color: '#fcd34d' },
  '.cm-swift-attribute': { color: '#93c5fd' },
  '.cm-swift-comment': { color: '#64748b', fontStyle: 'italic' },
  '.cm-tooltip': {
    backgroundColor: '#0f1720',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.86)',
  },
});

function setStatus(dirty: boolean) {
  if (!statusElement) return;
  statusElement.textContent = activePayload.readOnly ? 'Read only' : dirty ? 'Modified' : 'Saved';
  statusElement.classList.toggle('dirty', dirty);
  statusElement.title = '';
}

function setSavingStatus() {
  if (!statusElement) return;
  statusElement.textContent = 'Saving';
  statusElement.classList.remove('dirty');
  statusElement.title = '';
}

function setSaveFailureStatus(error?: string) {
  if (!statusElement) return;
  statusElement.textContent = 'Save failed';
  statusElement.classList.add('dirty');
  statusElement.title = error || 'The document could not be saved.';
}

function readOnlyExtensions(readOnly: boolean) {
  return [
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),
  ];
}

function editorExtensions() {
  return [
    highlightSpecialChars(),
    historyCompartment.of([history(), keymap.of(historyKeymap)]),
    lineNumbers(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    syntaxHighlighting(hudsonHighlightStyle),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    keymap.of([...defaultKeymap, indentWithTab]),
    languageCompartment.of(languageExtension('plain')),
    readOnlyCompartment.of(readOnlyExtensions(false)),
    hudsonEditorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (!update.docChanged || applyingDocument) return;
      const text = update.state.doc.toString();
      const dirty = text !== savedText;
      setStatus(dirty);
      window.clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => {
        post({ type: 'change', id: activePayload.id, text });
      }, 180);
    }),
    Prec.highest(keymap.of([{
      key: 'Mod-s',
      preventDefault: true,
      run(nextView) {
        if (activePayload.readOnly) {
          setStatus(false);
          return true;
        }
        const text = nextView.state.doc.toString();
        pendingSaveText = text;
        setSavingStatus();
        post({ type: 'save', id: activePayload.id, text });
        return true;
      },
    }])),
  ];
}

function updateChrome(payload: HudsonCodeMirrorPayload, language: string, readOnly: boolean) {
  const tint = payload.tintHex || '#5eead4';
  document.documentElement.style.setProperty('--tint', tint);
  rootElement?.classList.toggle('embedded', payload.embedded === true);
  if (payload.embedded) return;
  if (titleElement) titleElement.textContent = payload.path || labelFor(payload);
  if (badgeElement) badgeElement.textContent = language.toUpperCase();
  if (readOnly) {
    setStatus(false);
  }
}

function createEditorView(text: string, language: string, readOnly: boolean) {
  mountedLanguage = language;
  mountedReadOnly = readOnly;
  applyingDocument = true;
  const nextView = new EditorView({
    parent: editorHost!,
    state: EditorState.create({
      doc: text,
      extensions: editorExtensions(),
    }),
  });
  nextView.dispatch({
    effects: [
      languageCompartment.reconfigure(languageExtension(language)),
      readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)),
    ],
  });
  applyingDocument = false;
  return nextView;
}

function setDocument(payload: HudsonCodeMirrorPayload) {
  if (!editorHost) return;

  const language = normalizedLanguage(payload.language, payload.path);
  const text = payload.text || '';
  const readOnly = payload.readOnly === true;
  const documentID = payload.id;
  const switchingFile = documentID !== mountedDocumentID;

  activePayload = payload;
  pendingSaveText = null;
  updateChrome(payload, language, readOnly);

  if (!view) {
    mountedDocumentID = documentID;
    savedText = text;
    view = createEditorView(text, language, readOnly);
    setStatus(false);
    return;
  }

  const currentText = view.state.doc.toString();
  const effects = [];

  if (language !== mountedLanguage) {
    mountedLanguage = language;
    effects.push(languageCompartment.reconfigure(languageExtension(language)));
  }

  if (readOnly !== mountedReadOnly) {
    mountedReadOnly = readOnly;
    effects.push(readOnlyCompartment.reconfigure(readOnlyExtensions(readOnly)));
  }

  if (switchingFile) {
    mountedDocumentID = documentID;
    savedText = text;
    effects.push(historyCompartment.reconfigure([history(), keymap.of(historyKeymap)]));
  }

  const textChanged = text !== currentText;
  if (!textChanged && effects.length === 0) {
    setStatus(currentText !== savedText);
    return;
  }

  applyingDocument = true;
  view.dispatch({
    changes: textChanged ? { from: 0, to: view.state.doc.length, insert: text } : undefined,
    effects: effects.length ? effects : undefined,
    selection: switchingFile ? { anchor: 0 } : undefined,
    annotations: textChanged ? Transaction.addToHistory.of(!switchingFile) : undefined,
  });
  if (switchingFile) {
    view.scrollDOM.scrollTop = 0;
  }
  applyingDocument = false;
  setStatus(view.state.doc.toString() !== savedText);
}

window.__hudsonCodeMirror = {
  setDocument,
  saveResult(result) {
    if (result.id && activePayload.id && result.id !== activePayload.id) return;
    if (!result.success) {
      pendingSaveText = null;
      setSaveFailureStatus(result.error);
      return;
    }

    const nextSavedText = result.text ?? pendingSaveText ?? view?.state.doc.toString() ?? savedText;
    savedText = nextSavedText;
    pendingSaveText = null;
    const currentText = view?.state.doc.toString() ?? savedText;
    setStatus(currentText !== savedText);
  },
  focus() {
    view?.focus();
  },
};

post({ type: 'ready' });
