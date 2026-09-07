'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Eye, FileText, LoaderCircle, Pencil, Save } from 'lucide-react';
import { CodeEditor, type CodeEditorSelection, type DocumentLanguage } from './CodeEditor';
import { CodeViewer, type CodeLanguage } from './CodeViewer';

export type TextDocumentKind = 'text' | 'markdown' | 'code' | 'raw';
export type TextDocumentMode = 'edit' | 'read' | 'preview';

export interface HudsonTextDocument {
  id: string;
  title: string;
  uri?: string;
  mediaType?: string;
  language?: DocumentLanguage;
  kind: TextDocumentKind;
  value: string;
  readOnly?: boolean;
}

export interface TextDocumentDetectionInput {
  id?: string;
  title?: string;
  uri?: string;
  filename?: string;
  mediaType?: string;
  kind?: TextDocumentKind;
  language?: DocumentLanguage;
  value: string;
  readOnly?: boolean;
}

type MarkdownComponents = Record<string, unknown>;

interface MarkdownRuntimeProps {
  markdown: string;
  components: MarkdownComponents;
}

interface ReactMarkdownRuntimeProps {
  remarkPlugins?: unknown[];
  components?: MarkdownComponents;
  children: string;
}

const MissingMarkdownPeer: React.FC<MarkdownRuntimeProps> = () => (
  <div className="flex min-h-[180px] items-center justify-center p-6 text-center font-mono text-[11px] text-muted-foreground">
    Markdown preview requires the optional peer dependencies react-markdown and remark-gfm.
  </div>
);

const MarkdownRuntime = React.lazy(async () => {
  try {
    const [markdownModule, gfmModule] = await Promise.all([
      import('react-markdown'),
      import('remark-gfm'),
    ]);
    const ReactMarkdownRuntime = markdownModule.default as React.ComponentType<ReactMarkdownRuntimeProps>;
    const remarkGfmRuntime = gfmModule.default as unknown;

    const Runtime: React.FC<MarkdownRuntimeProps> = ({ markdown, components }) => (
      <ReactMarkdownRuntime remarkPlugins={[remarkGfmRuntime]} components={components}>
        {markdown}
      </ReactMarkdownRuntime>
    );

    return { default: Runtime };
  } catch {
    return { default: MissingMarkdownPeer };
  }
});

const EXTENSION_LANGUAGE: Record<string, DocumentLanguage> = {
  cjs: 'javascript',
  css: 'css',
  htm: 'html',
  html: 'html',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  mjs: 'javascript',
  md: 'markdown',
  mdx: 'markdown',
  sh: 'shell',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'plain',
};

const CODE_EXTENSIONS = new Set([
  'cjs',
  'css',
  'htm',
  'html',
  'js',
  'jsx',
  'json',
  'mjs',
  'sh',
  'ts',
  'tsx',
]);

function extensionFor(input: Pick<TextDocumentDetectionInput, 'filename' | 'title' | 'uri'>): string {
  const name = input.filename ?? input.title ?? input.uri ?? '';
  const clean = name.split(/[?#]/)[0];
  const basename = clean.split('/').pop() ?? clean;
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex >= 0 ? basename.slice(dotIndex + 1).toLowerCase() : '';
}

export function inferDocumentLanguage(input: Pick<TextDocumentDetectionInput, 'filename' | 'title' | 'uri' | 'mediaType'>): DocumentLanguage {
  const mediaType = input.mediaType?.toLowerCase() ?? '';
  if (mediaType.includes('json')) return 'json';
  if (mediaType.includes('markdown')) return 'markdown';
  if (mediaType.includes('javascript')) return 'javascript';
  if (mediaType.includes('typescript')) return 'typescript';
  if (mediaType.includes('html')) return 'html';
  if (mediaType.includes('css')) return 'css';
  if (mediaType.includes('shell') || mediaType.includes('x-sh')) return 'shell';

  return EXTENSION_LANGUAGE[extensionFor(input)] ?? 'plain';
}

export function detectTextDocumentKind(input: TextDocumentDetectionInput): TextDocumentKind {
  const mediaType = input.mediaType?.toLowerCase() ?? '';
  const extension = extensionFor(input);

  if (mediaType.includes('markdown') || extension === 'md' || extension === 'mdx') return 'markdown';
  if (mediaType.includes('json') || mediaType.includes('javascript') || mediaType.includes('typescript')) return 'code';
  if (mediaType.includes('html') || mediaType.includes('xml') || mediaType.includes('css')) return 'code';
  if (CODE_EXTENSIONS.has(extension)) return 'code';
  if (mediaType.startsWith('text/') || extension === 'txt') return 'text';

  const value = input.value.trim();
  if (/^#{1,6}\s+/m.test(value) || /```[\s\S]*```/.test(value)) return 'markdown';
  return 'text';
}

export function createHudsonTextDocument(input: TextDocumentDetectionInput): HudsonTextDocument {
  const title = input.title ?? input.filename ?? input.uri?.split('/').pop() ?? 'Untitled';
  const language = input.language ?? inferDocumentLanguage(input);
  return {
    id: input.id ?? input.uri ?? title,
    title,
    uri: input.uri,
    mediaType: input.mediaType,
    language,
    kind: input.kind ?? detectTextDocumentKind(input),
    value: input.value,
    readOnly: input.readOnly,
  };
}

export interface TextDocumentContextValue {
  document: HudsonTextDocument;
  value: string;
  savedValue: string;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  mode: TextDocumentMode;
  setMode: (mode: TextDocumentMode) => void;
  updateValue: (value: string) => void;
  save: () => Promise<boolean>;
}

export interface TextDocumentProviderProps {
  document: HudsonTextDocument;
  mode?: TextDocumentMode;
  children: ReactNode;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  onModeChange?: (mode: TextDocumentMode) => void;
}

const TextDocumentContext = createContext<TextDocumentContextValue | null>(null);

export function useTextDocument() {
  const context = useContext(TextDocumentContext);
  if (!context) throw new Error('useTextDocument must be used inside TextDocumentProvider');
  return context;
}

export function TextDocumentProvider({
  document,
  mode = document.kind === 'markdown' ? 'preview' : document.readOnly ? 'read' : 'edit',
  children,
  onChange,
  onSave,
  onModeChange,
}: TextDocumentProviderProps) {
  const [value, setValue] = useState(document.value);
  const [savedValue, setSavedValue] = useState(document.value);
  const [activeMode, setActiveMode] = useState<TextDocumentMode>(mode);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const documentIdRef = useRef(document.id);
  const pendingLocalValuesRef = useRef<string[]>([]);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (documentIdRef.current !== document.id) {
      documentIdRef.current = document.id;
      pendingLocalValuesRef.current = [];
      setValue(document.value);
      setSavedValue(document.value);
      setSaving(false);
      setSaveError(null);
      return;
    }

    const pendingIndex = pendingLocalValuesRef.current.indexOf(document.value);
    if (pendingIndex >= 0) {
      pendingLocalValuesRef.current.splice(0, pendingIndex + 1);
      return;
    }

    setValue(document.value);
    setSavedValue(document.value);
    setSaveError(null);
  }, [document.id, document.value]);

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  const setMode = useCallback((nextMode: TextDocumentMode) => {
    setActiveMode(nextMode);
    onModeChange?.(nextMode);
  }, [onModeChange]);

  const updateValue = useCallback((next: string) => {
    pendingLocalValuesRef.current = [...pendingLocalValuesRef.current.slice(-9), next];
    setValue(next);
    onChange?.(next);
  }, [onChange]);

  const save = useCallback((): Promise<boolean> => {
    if (saveInFlightRef.current) return saveInFlightRef.current;

    const valueToSave = value;
    const documentId = document.id;
    setSaving(true);
    setSaveError(null);

    const request = Promise.resolve()
      .then(() => onSave?.(valueToSave))
      .then(() => {
        if (documentIdRef.current === documentId) setSavedValue(valueToSave);
        return true;
      })
      .catch((error: unknown) => {
        if (documentIdRef.current === documentId) {
          setSaveError(error instanceof Error ? error.message : String(error));
        }
        return false;
      })
      .finally(() => {
        if (documentIdRef.current === documentId) setSaving(false);
        saveInFlightRef.current = null;
      });

    saveInFlightRef.current = request;
    return request;
  }, [document.id, onSave, value]);

  const contextValue = useMemo<TextDocumentContextValue>(() => ({
    document: { ...document, value },
    value,
    savedValue,
    dirty: value !== savedValue,
    saving,
    saveError,
    mode: activeMode,
    setMode,
    updateValue,
    save,
  }), [activeMode, document, saveError, savedValue, save, saving, setMode, updateValue, value]);

  return (
    <TextDocumentContext.Provider value={contextValue}>
      {children}
    </TextDocumentContext.Provider>
  );
}

export interface TextDocumentSurfaceProps {
  document: HudsonTextDocument;
  mode?: TextDocumentMode;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
  onModeChange?: (mode: TextDocumentMode) => void;
  onSelectionChange?: (selection: CodeEditorSelection) => void;
  showHeader?: boolean;
  className?: string;
}

export function TextDocumentSurface(props: TextDocumentSurfaceProps) {
  return (
    <TextDocumentProvider
      document={props.document}
      mode={props.mode}
      onChange={props.onChange}
      onSave={props.onSave}
      onModeChange={props.onModeChange}
    >
      <TextDocumentSurfaceInner
        className={props.className}
        showHeader={props.showHeader}
        onSelectionChange={props.onSelectionChange}
      />
    </TextDocumentProvider>
  );
}

export function TextDocumentSurfaceInner({
  className,
  showHeader = true,
  onSelectionChange,
}: {
  className?: string;
  showHeader?: boolean;
  onSelectionChange?: (selection: CodeEditorSelection) => void;
}) {
  const { document, mode, setMode, dirty, saving, saveError, save } = useTextDocument();
  const isMarkdown = document.kind === 'markdown';
  const isCode = document.kind === 'code';
  const editable = !document.readOnly && mode !== 'read' && mode !== 'preview';

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden border border-border/60 bg-card/85 ${className ?? ''}`}>
      {showHeader && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
          <FileText size={13} className="shrink-0 text-cyan-700/70 dark:text-cyan-300/55" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-foreground/86">{document.title}</div>
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              {document.uri ?? document.mediaType ?? document.kind}
            </div>
          </div>
          {dirty && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-amber-700/80 dark:text-amber-300/70">Modified</span>
          )}
          {saveError && (
            <span className="max-w-40 truncate font-mono text-[9px] text-red-700/80 dark:text-red-300/70" title={saveError}>
              Save failed
            </span>
          )}
          {isMarkdown && (
            <div className="flex rounded border border-border/60 bg-card/60 p-0.5">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'preview' ? 'bg-cyan-700/15 dark:bg-cyan-400/15 text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground hover:text-foreground/72'}`}
                title="Preview markdown"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'edit' ? 'bg-cyan-700/15 dark:bg-cyan-400/15 text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground hover:text-foreground/72'}`}
                title="Edit markdown source"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          {isCode && (
            <div className="flex rounded border border-border/60 bg-card/60 p-0.5">
              <button
                type="button"
                onClick={() => setMode('read')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'read' ? 'bg-cyan-700/15 dark:bg-cyan-400/15 text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground hover:text-foreground/72'}`}
                title="Read only"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'edit' ? 'bg-cyan-700/15 dark:bg-cyan-400/15 text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground hover:text-foreground/72'}`}
                title="Edit code"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          {!document.readOnly && mode === 'edit' && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded border border-cyan-700/30 dark:border-cyan-300/15 bg-cyan-700/10 dark:bg-cyan-400/10 p-1.5 text-cyan-700 dark:text-cyan-200/75 hover:bg-cyan-700/15 dark:hover:bg-cyan-400/16 hover:text-cyan-700 dark:hover:text-cyan-100"
              title={saving ? 'Saving document' : 'Save document'}
            >
              {saving ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
            </button>
          )}
        </div>
      )}
      <DocumentBody editable={editable} onSelectionChange={onSelectionChange} />
    </div>
  );
}

function DocumentBody({
  editable,
  onSelectionChange,
}: {
  editable: boolean;
  onSelectionChange?: (selection: CodeEditorSelection) => void;
}) {
  const { document, value, mode, updateValue, save } = useTextDocument();

  if (document.kind === 'markdown' && mode === 'preview') {
    return <MarkdownPreview markdown={value} className="flex-1 overflow-auto px-6 py-5" />;
  }

  if (document.kind === 'code' || document.kind === 'markdown') {
    return (
      <CodeEditor
        code={value}
        language={document.language ?? (document.kind === 'markdown' ? 'markdown' : 'plain')}
        readOnly={!editable}
        onChange={updateValue}
        onSave={save}
        onSelectionChange={onSelectionChange}
        className="flex-1"
      />
    );
  }

  if (editable) {
    return (
      <textarea
        value={value}
        onChange={event => updateValue(event.target.value)}
        className="min-h-0 flex-1 resize-none bg-card/85 px-5 py-4 font-mono text-[12px] leading-relaxed text-foreground/82 outline-none placeholder:text-muted-foreground"
        placeholder="Start typing"
        spellCheck={false}
      />
    );
  }

  return (
    <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-card/85 px-5 py-4 font-mono text-[12px] leading-relaxed text-foreground/82">
      {value}
    </pre>
  );
}

function MarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  const components = useMemo<MarkdownComponents>(() => ({
    h1: (props: React.ComponentPropsWithoutRef<'h1'>) => <h1 className="mb-3 mt-1 text-[18px] font-semibold text-foreground/92" {...props} />,
    h2: (props: React.ComponentPropsWithoutRef<'h2'>) => <h2 className="mb-2 mt-5 text-[15px] font-semibold text-foreground/88" {...props} />,
    h3: (props: React.ComponentPropsWithoutRef<'h3'>) => <h3 className="mb-2 mt-4 text-[13px] font-semibold text-foreground/84" {...props} />,
    p: (props: React.ComponentPropsWithoutRef<'p'>) => <p className="my-3" {...props} />,
    ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul className="my-3 list-disc space-y-1 pl-5 text-foreground/72" {...props} />,
    ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol className="my-3 list-decimal space-y-1 pl-5 text-foreground/72" {...props} />,
    blockquote: (props: React.ComponentPropsWithoutRef<'blockquote'>) => <blockquote className="my-3 border-l-2 border-cyan-700/40 dark:border-cyan-300/35 pl-3 text-muted-foreground italic" {...props} />,
    a: (props: React.ComponentPropsWithoutRef<'a'>) => <a className="text-cyan-700 dark:text-cyan-300/78 underline underline-offset-2 hover:text-cyan-700/80 dark:hover:text-cyan-200" target="_blank" rel="noreferrer" {...props} />,
    hr: (props: React.ComponentPropsWithoutRef<'hr'>) => <hr className="my-5 border-border/60" {...props} />,
    table: (props: React.ComponentPropsWithoutRef<'table'>) => <div className="my-4 overflow-auto"><table className="w-full border-collapse text-left" {...props} /></div>,
    th: (props: React.ComponentPropsWithoutRef<'th'>) => <th className="border border-border/60 bg-muted/40 px-2 py-1 text-foreground/82" {...props} />,
    td: (props: React.ComponentPropsWithoutRef<'td'>) => <td className="border border-border/60 px-2 py-1 text-foreground/72" {...props} />,
    code: ({ children, className: codeClassName, ...props }: React.ComponentPropsWithoutRef<'code'>) => {
      const match = /language-(\w+)/.exec(codeClassName ?? '');
      const code = String(children).replace(/\n$/, '');
      if (match) {
        return (
          <CodeViewer
            code={code}
            language={toCodeLanguage(match[1])}
            showCopy
            showLineNumbers
            className="my-3"
          />
        );
      }
      return (
        <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[12px] text-cyan-700 dark:text-cyan-200/80" {...props}>
          {children}
        </code>
      );
    },
  }), []);

  return (
    <div className={`text-[13px] leading-relaxed text-foreground/76 ${className ?? ''}`}>
      <React.Suspense fallback={<MarkdownPreviewLoading />}>
        <MarkdownRuntime markdown={markdown} components={components} />
      </React.Suspense>
    </div>
  );
}

function MarkdownPreviewLoading() {
  return (
    <div className="flex min-h-[180px] items-center justify-center font-mono text-[11px] text-muted-foreground">
      Loading markdown preview…
    </div>
  );
}

function toCodeLanguage(language: string): CodeLanguage {
  if (language === 'ts' || language === 'tsx' || language === 'typescript') return 'typescript';
  if (language === 'js' || language === 'jsx' || language === 'javascript') return 'javascript';
  if (language === 'json') return 'json';
  if (language === 'css') return 'css';
  if (language === 'html') return 'html';
  if (language === 'sh' || language === 'bash' || language === 'shell') return 'shell';
  return 'plain';
}
