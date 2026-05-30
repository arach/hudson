'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { usePersistentState, type TextDocumentMode } from 'hudsonkit';
import {
  coerceCodeDocumentFromInput,
  createScratchCodeDocument,
  getCodeDocumentParseError,
  parseCodeDocumentJson,
  serializeCodeDocument,
  type HudsonCodeDocument,
} from './types';

interface CodeEditorContextValue {
  documents: HudsonCodeDocument[];
  activeDocumentId: string | null;
  activeDocument: HudsonCodeDocument | null;
  activeMode: TextDocumentMode;
  parseError: string | null;
  selectDocument: (id: string) => void;
  createDocument: (language?: 'json' | 'javascript' | 'plain') => void;
  deleteDocument: (id: string) => void;
  setActiveMode: (mode: TextDocumentMode) => void;
  updateActiveDocument: (value: string) => void;
  saveActiveDocument: (value: string) => void;
  formatActiveJson: () => void;
  openFromInput: (portId: string, data: unknown) => void;
  getOutput: (portId: string) => unknown | null;
}

const CodeEditorContext = createContext<CodeEditorContextValue | null>(null);

const INITIAL_DOCUMENTS = [createScratchCodeDocument()];

function modeForDocument(document: HudsonCodeDocument | null): TextDocumentMode {
  if (!document) return 'edit';
  if (document.readOnly) return 'read';
  if (document.kind === 'markdown') return 'preview';
  return 'edit';
}

function createBlankDocument(language: 'json' | 'javascript' | 'plain'): HudsonCodeDocument {
  if (language === 'javascript') {
    return coerceCodeDocumentFromInput({
      title: 'snippet.js',
      mediaType: 'text/javascript',
      language: 'javascript',
      kind: 'code',
      value: [
        'export function run(input) {',
        '  return input;',
        '}',
      ].join('\n'),
    }, { idPrefix: 'snippet' });
  }

  if (language === 'plain') {
    return coerceCodeDocumentFromInput({
      title: 'notes.txt',
      mediaType: 'text/plain',
      language: 'plain',
      kind: 'text',
      value: '',
    }, { idPrefix: 'text' });
  }

  return coerceCodeDocumentFromInput({
    title: 'object.json',
    mediaType: 'application/json',
    language: 'json',
    kind: 'code',
    value: '{\n  "value": null\n}',
  }, { idPrefix: 'json' });
}

export function useCodeEditor() {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error('useCodeEditor must be used inside CodeEditorProvider');
  return context;
}

export function CodeEditorProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = usePersistentState<HudsonCodeDocument[]>('code-editor.documents', INITIAL_DOCUMENTS);
  const [activeDocumentId, setActiveDocumentId] = usePersistentState<string | null>('code-editor.activeDocumentId', INITIAL_DOCUMENTS[0].id);
  const [modesById, setModesById] = usePersistentState<Record<string, TextDocumentMode>>('code-editor.modes', {
    [INITIAL_DOCUMENTS[0].id]: 'edit',
  });

  const activeDocument = useMemo(
    () => documents.find(document => document.id === activeDocumentId) ?? documents[0] ?? null,
    [activeDocumentId, documents],
  );

  const activeMode = activeDocument
    ? modesById[activeDocument.id] ?? modeForDocument(activeDocument)
    : 'edit';

  const parseError = useMemo(() => getCodeDocumentParseError(activeDocument), [activeDocument]);

  const selectDocument = useCallback((id: string) => {
    setActiveDocumentId(id);
  }, [setActiveDocumentId]);

  const upsertDocument = useCallback((document: HudsonCodeDocument) => {
    setDocuments(previous => {
      const existingIndex = previous.findIndex(item => item.id === document.id);
      if (existingIndex === -1) return [document, ...previous];
      const next = [...previous];
      next[existingIndex] = document;
      return next;
    });
    setActiveDocumentId(document.id);
    setModesById(previous => ({
      ...previous,
      [document.id]: modeForDocument(document),
    }));
  }, [setActiveDocumentId, setDocuments, setModesById]);

  const createDocument = useCallback((language: 'json' | 'javascript' | 'plain' = 'json') => {
    upsertDocument(createBlankDocument(language));
  }, [upsertDocument]);

  const deleteDocument = useCallback((id: string) => {
    setDocuments(previous => {
      const next = previous.filter(document => document.id !== id);
      if (activeDocumentId === id) {
        setActiveDocumentId(next[0]?.id ?? null);
      }
      return next;
    });
    setModesById(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, [activeDocumentId, setActiveDocumentId, setDocuments, setModesById]);

  const setActiveMode = useCallback((mode: TextDocumentMode) => {
    if (!activeDocument) return;
    setModesById(previous => ({ ...previous, [activeDocument.id]: mode }));
  }, [activeDocument, setModesById]);

  const updateActiveDocument = useCallback((value: string) => {
    if (!activeDocument) return;
    setDocuments(previous => previous.map(document => (
      document.id === activeDocument.id
        ? { ...document, value, updatedAt: Date.now() }
        : document
    )));
  }, [activeDocument, setDocuments]);

  const saveActiveDocument = useCallback((value: string) => {
    if (!activeDocument) return;
    setDocuments(previous => previous.map(document => (
      document.id === activeDocument.id
        ? { ...document, value, updatedAt: Date.now(), savedAt: Date.now() }
        : document
    )));
  }, [activeDocument, setDocuments]);

  const formatActiveJson = useCallback(() => {
    if (!activeDocument) return;
    const parsed = parseCodeDocumentJson(activeDocument);
    if (parsed === null) return;
    updateActiveDocument(JSON.stringify(parsed, null, 2));
  }, [activeDocument, updateActiveDocument]);

  const openFromInput = useCallback((portId: string, data: unknown) => {
    const isTextPort = portId === 'text';
    const isJsonPort = portId === 'json';
    const document = coerceCodeDocumentFromInput(data, {
      idPrefix: portId,
      title: isTextPort ? 'piped.txt' : isJsonPort ? 'object.json' : undefined,
      language: isTextPort ? 'plain' : isJsonPort ? 'json' : undefined,
      mediaType: isTextPort ? 'text/plain' : isJsonPort ? 'application/json' : undefined,
      kind: isTextPort ? 'text' : isJsonPort ? 'code' : undefined,
      source: { portId },
    });
    upsertDocument(document);
  }, [upsertDocument]);

  const getOutput = useCallback((portId: string): unknown | null => {
    if (!activeDocument) return null;
    if (portId === 'text') return activeDocument.value;
    if (portId === 'json') return parseCodeDocumentJson(activeDocument);
    if (portId === 'document') return serializeCodeDocument(activeDocument);
    return null;
  }, [activeDocument]);

  const value = useMemo<CodeEditorContextValue>(() => ({
    documents,
    activeDocumentId: activeDocument?.id ?? null,
    activeDocument,
    activeMode,
    parseError,
    selectDocument,
    createDocument,
    deleteDocument,
    setActiveMode,
    updateActiveDocument,
    saveActiveDocument,
    formatActiveJson,
    openFromInput,
    getOutput,
  }), [
    activeDocument,
    activeMode,
    createDocument,
    deleteDocument,
    documents,
    formatActiveJson,
    getOutput,
    openFromInput,
    parseError,
    saveActiveDocument,
    selectDocument,
    setActiveMode,
    updateActiveDocument,
  ]);

  return (
    <CodeEditorContext.Provider value={value}>
      {children}
    </CodeEditorContext.Provider>
  );
}
