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
import { Eye, FileText, Pencil, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeEditor, type DocumentLanguage } from './CodeEditor';
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
  mode: TextDocumentMode;
  setMode: (mode: TextDocumentMode) => void;
  updateValue: (value: string) => void;
  save: () => void;
}

export interface TextDocumentProviderProps {
  document: HudsonTextDocument;
  mode?: TextDocumentMode;
  children: ReactNode;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
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
  const documentIdRef = useRef(document.id);
  const pendingLocalValuesRef = useRef<string[]>([]);

  useEffect(() => {
    if (documentIdRef.current !== document.id) {
      documentIdRef.current = document.id;
      pendingLocalValuesRef.current = [];
      setValue(document.value);
      setSavedValue(document.value);
      return;
    }

    const pendingIndex = pendingLocalValuesRef.current.indexOf(document.value);
    if (pendingIndex >= 0) {
      pendingLocalValuesRef.current.splice(0, pendingIndex + 1);
      return;
    }

    setValue(document.value);
    setSavedValue(document.value);
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

  const save = useCallback(() => {
    setSavedValue(value);
    onSave?.(value);
  }, [onSave, value]);

  const contextValue = useMemo<TextDocumentContextValue>(() => ({
    document: { ...document, value },
    value,
    savedValue,
    dirty: value !== savedValue,
    mode: activeMode,
    setMode,
    updateValue,
    save,
  }), [activeMode, document, savedValue, save, setMode, updateValue, value]);

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
  onSave?: (value: string) => void;
  onModeChange?: (mode: TextDocumentMode) => void;
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
      <TextDocumentSurfaceInner className={props.className} showHeader={props.showHeader} />
    </TextDocumentProvider>
  );
}

export function TextDocumentSurfaceInner({
  className,
  showHeader = true,
}: {
  className?: string;
  showHeader?: boolean;
}) {
  const { document, mode, setMode, dirty, save } = useTextDocument();
  const isMarkdown = document.kind === 'markdown';
  const isCode = document.kind === 'code';
  const editable = !document.readOnly && mode !== 'read' && mode !== 'preview';

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden border border-white/[0.06] bg-[#0a0f12] ${className ?? ''}`}>
      {showHeader && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <FileText size={13} className="shrink-0 text-cyan-300/55" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-white/78">{document.title}</div>
            <div className="truncate font-mono text-[10px] text-white/28">
              {document.uri ?? document.mediaType ?? document.kind}
            </div>
          </div>
          {dirty && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300/70">Modified</span>
          )}
          {isMarkdown && (
            <div className="flex rounded border border-white/[0.08] bg-white/[0.03] p-0.5">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'preview' ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/34 hover:text-white/62'}`}
                title="Preview markdown"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'edit' ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/34 hover:text-white/62'}`}
                title="Edit markdown source"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          {isCode && (
            <div className="flex rounded border border-white/[0.08] bg-white/[0.03] p-0.5">
              <button
                type="button"
                onClick={() => setMode('read')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'read' ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/34 hover:text-white/62'}`}
                title="Read only"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`rounded px-2 py-1 text-[10px] ${mode === 'edit' ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/34 hover:text-white/62'}`}
                title="Edit code"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          {!document.readOnly && mode === 'edit' && (
            <button
              type="button"
              onClick={save}
              className="rounded border border-cyan-300/15 bg-cyan-400/10 p-1.5 text-cyan-200/75 hover:bg-cyan-400/16 hover:text-cyan-100"
              title="Save document"
            >
              <Save size={13} />
            </button>
          )}
        </div>
      )}
      <DocumentBody editable={editable} />
    </div>
  );
}

function DocumentBody({ editable }: { editable: boolean }) {
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
        className="flex-1"
      />
    );
  }

  if (editable) {
    return (
      <textarea
        value={value}
        onChange={event => updateValue(event.target.value)}
        className="min-h-0 flex-1 resize-none bg-[#0a0f12] px-5 py-4 font-mono text-[12px] leading-relaxed text-white/72 outline-none placeholder:text-white/18"
        placeholder="Start typing..."
        spellCheck={false}
      />
    );
  }

  return (
    <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-[#0a0f12] px-5 py-4 font-mono text-[12px] leading-relaxed text-white/72">
      {value}
    </pre>
  );
}

function MarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={`text-[13px] leading-relaxed text-white/68 ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: props => <h1 className="mb-3 mt-1 text-[18px] font-semibold text-white/90" {...props} />,
          h2: props => <h2 className="mb-2 mt-5 text-[15px] font-semibold text-white/86" {...props} />,
          h3: props => <h3 className="mb-2 mt-4 text-[13px] font-semibold text-white/82" {...props} />,
          p: props => <p className="my-3" {...props} />,
          ul: props => <ul className="my-3 list-disc space-y-1 pl-5 text-white/62" {...props} />,
          ol: props => <ol className="my-3 list-decimal space-y-1 pl-5 text-white/62" {...props} />,
          blockquote: props => <blockquote className="my-3 border-l-2 border-cyan-300/35 pl-3 text-white/46 italic" {...props} />,
          a: props => <a className="text-cyan-300/78 underline underline-offset-2 hover:text-cyan-200" target="_blank" rel="noreferrer" {...props} />,
          hr: props => <hr className="my-5 border-white/[0.08]" {...props} />,
          table: props => <div className="my-4 overflow-auto"><table className="w-full border-collapse text-left" {...props} /></div>,
          th: props => <th className="border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-white/78" {...props} />,
          td: props => <td className="border border-white/[0.06] px-2 py-1 text-white/62" {...props} />,
          code: ({ children, className: codeClassName, ...props }) => {
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
              <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[12px] text-cyan-200/80" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
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
