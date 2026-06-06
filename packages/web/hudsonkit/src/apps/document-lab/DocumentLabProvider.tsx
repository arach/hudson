'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HudsonTextDiff, HudsonTextDocument, TextDocumentMode } from '../../controls';

const initialDocuments: HudsonTextDocument[] = [
  {
    id: 'plain',
    title: 'meeting-notes.txt',
    uri: 'hudson://workspace/meeting-notes.txt',
    mediaType: 'text/plain',
    kind: 'text',
    language: 'plain',
    value: [
      'Plain text stays plain.',
      '',
      'No markdown preview. No syntax highlighting. Just a good text buffer with dirty tracking and save semantics.',
      '',
      'This is the baseline document primitive.',
    ].join('\n'),
  },
  {
    id: 'markdown',
    title: 'editor-plan.md',
    uri: 'hudson://workspace/editor-plan.md',
    mediaType: 'text/markdown',
    kind: 'markdown',
    language: 'markdown',
    value: [
      '# Document Primitive',
      '',
      'Markdown is a special surface over the same text document provider.',
      '',
      '- Preview mode renders the document.',
      '- Source mode uses the same CodeMirror editor.',
      '- Code fences reuse the code viewer.',
      '',
      '```ts',
      'export interface HudsonTextDocument {',
      '  id: string;',
      '  title: string;',
      '  value: string;',
      '}',
      '```',
      '',
      '> The model stays boring; the surface gets smarter.',
    ].join('\n'),
  },
  {
    id: 'code',
    title: 'HudsonDocumentSurface.tsx',
    uri: 'hudson://workspace/HudsonDocumentSurface.tsx',
    mediaType: 'text/typescript',
    kind: 'code',
    language: 'typescript',
    value: [
      "import { TextDocumentSurface } from 'hudsonkit/controls';",
      '',
      'export function CanvasDocumentWindow() {',
      '  return (',
      '    <TextDocumentSurface',
      '      document={document}',
      '      mode="edit"',
      '      onChange={updateDocument}',
      '    />',
      '  );',
      '}',
    ].join('\n'),
  },
];

const initialDiffs: HudsonTextDiff[] = [
  {
    id: 'code-review',
    title: 'HudsonDocumentSurface.tsx',
    kind: 'documents',
    layout: 'split',
    oldDocument: {
      title: 'HudsonDocumentSurface.tsx',
      uri: 'hudson://workspace/HudsonDocumentSurface.tsx',
      language: 'typescript',
      value: [
        "import { TextDocumentSurface } from 'hudsonkit/controls';",
        '',
        'export function CanvasDocumentWindow() {',
        '  return (',
        '    <TextDocumentSurface',
        '      document={document}',
        '      mode="read"',
        '    />',
        '  );',
        '}',
      ].join('\n'),
    },
    newDocument: {
      title: 'HudsonDocumentSurface.tsx',
      uri: 'hudson://workspace/HudsonDocumentSurface.tsx',
      language: 'typescript',
      value: [
        "import { TextDiffSurface, TextDocumentSurface } from 'hudsonkit/controls';",
        '',
        'export function CanvasDocumentWindow({ compare }) {',
        '  if (compare) {',
        '    return <TextDiffSurface diff={compare} layout="split" />;',
        '  }',
        '',
        '  return (',
        '    <TextDocumentSurface',
        '      document={document}',
        '      mode="edit"',
        '      onChange={updateDocument}',
        '    />',
        '  );',
        '}',
      ].join('\n'),
    },
  },
];

interface DocumentLabContextValue {
  documents: HudsonTextDocument[];
  diffs: HudsonTextDiff[];
  activeDocument: HudsonTextDocument;
  activeDocumentId: string;
  activeMode: TextDocumentMode;
  activeDiff: HudsonTextDiff;
  selectDocument: (id: string) => void;
  setActiveMode: (mode: TextDocumentMode) => void;
  updateActiveDocument: (value: string) => void;
  saveActiveDocument: (value: string) => void;
}

const DocumentLabContext = createContext<DocumentLabContextValue | null>(null);

export function useDocumentLab() {
  const context = useContext(DocumentLabContext);
  if (!context) throw new Error('useDocumentLab must be used inside DocumentLabProvider');
  return context;
}

export function DocumentLabProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeDocumentId, setActiveDocumentId] = useState(initialDocuments[1].id);
  const [modesById, setModesById] = useState<Record<string, TextDocumentMode>>({
    plain: 'edit',
    markdown: 'preview',
    code: 'read',
  });

  const activeDocument = useMemo(
    () => documents.find(document => document.id === activeDocumentId) ?? documents[0],
    [activeDocumentId, documents],
  );

  const activeMode = modesById[activeDocument.id] ?? (activeDocument.kind === 'markdown' ? 'preview' : 'edit');
  const activeDiff = initialDiffs[0];

  const selectDocument = useCallback((id: string) => {
    setActiveDocumentId(id);
  }, []);

  const setActiveMode = useCallback((mode: TextDocumentMode) => {
    setModesById(previous => ({ ...previous, [activeDocumentId]: mode }));
  }, [activeDocumentId]);

  const updateActiveDocument = useCallback((value: string) => {
    setDocuments(previous => previous.map(document => (
      document.id === activeDocumentId ? { ...document, value } : document
    )));
  }, [activeDocumentId]);

  const saveActiveDocument = useCallback((value: string) => {
    updateActiveDocument(value);
  }, [updateActiveDocument]);

  const value = useMemo<DocumentLabContextValue>(() => ({
    documents,
    diffs: initialDiffs,
    activeDocument,
    activeDocumentId,
    activeMode,
    activeDiff,
    selectDocument,
    setActiveMode,
    updateActiveDocument,
    saveActiveDocument,
  }), [
    activeDocument,
    activeDocumentId,
    activeDiff,
    activeMode,
    documents,
    saveActiveDocument,
    selectDocument,
    setActiveMode,
    updateActiveDocument,
  ]);

  return (
    <DocumentLabContext.Provider value={value}>
      {children}
    </DocumentLabContext.Provider>
  );
}
