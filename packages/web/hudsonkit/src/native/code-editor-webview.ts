import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, Prec, RangeSetBuilder } from '@codemirror/state';
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
import { hudsonHighlightStyle, hudsonEditorTheme } from '../editor/code-theme';

type HudsonCodeEditorPayload = {
  id?: string;
  title?: string;
  path?: string;
  language?: string;
  text?: string;
  readOnly?: boolean;
  tintHex?: string;
};

type HudsonCodeEditorMessage =
  | { type: 'ready' }
  | { type: 'change'; id?: string; text: string }
  | { type: 'save'; id?: string; text: string };

declare global {
  interface Window {
    __hudsonCodeEditor?: {
      setDocument: (payload: HudsonCodeEditorPayload) => void;
      saveResult: (result: { id?: string; success: boolean; text?: string; error?: string }) => void;
      focus: () => void;
    };
    webkit?: {
      messageHandlers?: {
        hudsonCodeEditor?: {
          postMessage: (message: HudsonCodeEditorMessage) => void;
        };
      };
    };
  }
}

const editorHost = document.getElementById('editor');
const titleElement = document.getElementById('title');
const badgeElement = document.getElementById('badge');
const statusElement = document.getElementById('status');

let view: EditorView | null = null;
let activePayload: HudsonCodeEditorPayload = {};
let savedText = '';
let pendingSaveText: string | null = null;
let changeTimer: number | undefined;
let applyingDocument = false;

function post(message: HudsonCodeEditorMessage) {
  window.webkit?.messageHandlers?.hudsonCodeEditor?.postMessage(message);
}

function labelFor(payload: HudsonCodeEditorPayload): string {
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

function editorExtensions(language: string, readOnly: boolean) {
  return [
    highlightSpecialChars(),
    history(),
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
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    languageExtension(language),
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),
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

function setDocument(payload: HudsonCodeEditorPayload) {
  if (!editorHost) return;

  activePayload = payload;
  savedText = payload.text || '';
  pendingSaveText = null;
  const language = normalizedLanguage(payload.language, payload.path);
  const tint = payload.tintHex || '#5eead4';
  document.documentElement.style.setProperty('--tint', tint);

  if (titleElement) titleElement.textContent = payload.path || labelFor(payload);
  if (badgeElement) badgeElement.textContent = language.toUpperCase();
  setStatus(false);

  applyingDocument = true;
  view?.destroy();
  view = new EditorView({
    parent: editorHost,
    state: EditorState.create({
      doc: savedText,
      extensions: editorExtensions(language, payload.readOnly === true),
    }),
  });
  applyingDocument = false;
}

window.__hudsonCodeEditor = {
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
