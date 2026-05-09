'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BUILT_IN_TEMPLATE_IDS,
  allTokenKeys,
  cloneTemplate,
  diffTemplateTokens,
  effectiveTokens,
  emitTemplateCss,
  isValidTemplateId,
  parseThemeCss,
  sanitizeTemplateId,
  templateLabel,
  updateTemplateToken,
  type ThemeMode,
  type ThemeTemplateRecord,
} from './model';

interface ThemeDesignerContextValue {
  templates: ThemeTemplateRecord[];
  savedTemplates: ThemeTemplateRecord[];
  selectedTemplateId: string;
  selectedMode: ThemeMode;
  selectedToken: string;
  selectedGroup: string;
  exportTemplateId: string;
  refId: string;
  registerRef: boolean;
  saveStatus: string;
  importCss: string;
  isDev: boolean;
  currentTemplate: ThemeTemplateRecord | null;
  savedTemplate: ThemeTemplateRecord | undefined;
  effective: Record<string, string>;
  tokenKeys: string[];
  changedKeys: string[];
  cssBlock: string;
  refSnippet: string;
  setSelectedTemplateId: (id: string) => void;
  setSelectedMode: (mode: ThemeMode) => void;
  setSelectedToken: (token: string) => void;
  setSelectedGroup: (group: string) => void;
  setExportTemplateId: (id: string) => void;
  setRefId: (id: string) => void;
  setRegisterRef: (value: boolean) => void;
  setImportCss: (value: string) => void;
  updateToken: (key: string, value: string) => void;
  resetToken: (key: string) => void;
  copyCss: () => Promise<void>;
  downloadCss: () => void;
  importFromCss: () => void;
  saveTemplate: () => Promise<void>;
  createCopy: () => void;
}

const ThemeDesignerContext = createContext<ThemeDesignerContextValue | null>(null);

function fallbackTemplate(): ThemeTemplateRecord {
  return {
    id: 'hudson',
    base: {},
    themes: {
      dark: {
        'color-scheme': 'dark',
        '--background': '0.145 0 0',
        '--foreground': '0.95 0 0',
        '--card': '0.18 0 0',
        '--card-foreground': '0.95 0 0',
        '--accent': '0.72 0.18 162',
        '--accent-foreground': '0.145 0 0',
        '--border': '0.28 0 0',
        '--ring': '0.72 0.18 162',
        '--radius': '8px',
      },
      light: {
        'color-scheme': 'light',
        '--background': '0.975 0.008 90',
        '--foreground': '0.21 0.02 260',
        '--card': '1 0 0',
        '--card-foreground': '0.19 0.02 260',
        '--accent': '0.58 0.19 162',
        '--accent-foreground': '0.99 0 0',
        '--border': '0.92 0.014 80',
        '--ring': '0.58 0.19 162',
        '--radius': '8px',
      },
    },
  };
}

function replaceTemplate(list: ThemeTemplateRecord[], next: ThemeTemplateRecord): ThemeTemplateRecord[] {
  const idx = list.findIndex(template => template.id === next.id);
  if (idx === -1) return [...list, next].sort((a, b) => a.id.localeCompare(b.id));
  return list.map(template => template.id === next.id ? next : template);
}

function defaultCustomId(sourceId: string): string {
  const base = sanitizeTemplateId(`${sourceId}-custom`);
  return isValidTemplateId(base) ? base : 'theme-custom';
}

// Always return the same defaults that the root layout SSRs onto <html>, so
// the first client render matches the server string. The pre-paint script
// in app/layout.tsx may flip the dataset to a persisted/URL value before
// hydration; we sync to that in a mount effect (see below) to avoid a
// hydration mismatch.
const SSR_DEFAULT_MODE: ThemeMode = 'dark';
const SSR_DEFAULT_TEMPLATE = 'hudson';

function readDatasetMode(): ThemeMode {
  if (typeof document === 'undefined') return SSR_DEFAULT_MODE;
  return document.documentElement.dataset.hudsonTheme === 'light' ? 'light' : 'dark';
}

function readDatasetTemplate(): string {
  if (typeof document === 'undefined') return SSR_DEFAULT_TEMPLATE;
  return document.documentElement.dataset.hudsonTemplate || SSR_DEFAULT_TEMPLATE;
}

export function ThemeDesignerProvider({
  children,
  disabled = false,
  visible = true,
}: {
  children: ReactNode;
  disabled?: boolean;
  visible?: boolean;
  focused?: boolean;
}) {
  const [templates, setTemplates] = useState<ThemeTemplateRecord[]>([fallbackTemplate()]);
  const [savedTemplates, setSavedTemplates] = useState<ThemeTemplateRecord[]>([fallbackTemplate()]);
  const [selectedTemplateId, setSelectedTemplateIdState] = useState(SSR_DEFAULT_TEMPLATE);
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(SSR_DEFAULT_MODE);
  const [selectedToken, setSelectedToken] = useState('--accent');
  const [selectedGroup, setSelectedGroup] = useState('accent');
  const [exportTemplateId, setExportTemplateIdState] = useState(() => defaultCustomId(SSR_DEFAULT_TEMPLATE));
  const [refId, setRefIdState] = useState(() => defaultCustomId(SSR_DEFAULT_TEMPLATE));
  const [registerRef, setRegisterRef] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Loading templates…');
  const [importCss, setImportCss] = useState('');
  const [isDev, setIsDev] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const appliedKeysRef = useRef<Set<string>>(new Set());

  // Sync state to the actual <html> dataset after hydration. The pre-paint
  // script may have flipped these from the SSR defaults based on localStorage
  // or URL params; that's fine — we just match it post-mount.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const mode = readDatasetMode();
      const template = readDatasetTemplate();
      setSelectedMode(mode);
      setSelectedTemplateIdState(template);
      setExportTemplateIdState(defaultCustomId(template));
      setRefIdState(defaultCustomId(template));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/theme-designer')
      .then(response => response.json())
      .then(data => {
        if (cancelled) return;
        const parsed = Array.isArray(data.templates) && data.templates.length > 0
          ? data.templates as ThemeTemplateRecord[]
          : [fallbackTemplate()];
        setTemplates(parsed.map(cloneTemplate));
        setSavedTemplates(parsed.map(cloneTemplate));
        setIsDev(Boolean(data.dev));
        const rootTemplate = readDatasetTemplate();
        const nextTemplate = parsed.some(template => template.id === rootTemplate) ? rootTemplate : parsed[0].id;
        setSelectedTemplateIdState(nextTemplate);
        setExportTemplateIdState(defaultCustomId(nextTemplate));
        setRefIdState(defaultCustomId(nextTemplate));
        setTemplatesLoaded(true);
        setSaveStatus('Ready');
      })
      .catch(error => {
        if (!cancelled) {
          const fallback = fallbackTemplate();
          setTemplates([fallback]);
          setSavedTemplates([fallback]);
          setSelectedTemplateIdState(fallback.id);
          setExportTemplateIdState(defaultCustomId(fallback.id));
          setRefIdState(defaultCustomId(fallback.id));
          setTemplatesLoaded(true);
          setSaveStatus(`Using fallback tokens · ${String(error)}`);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const currentTemplate = useMemo(
    () => templates.find(template => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const savedTemplate = useMemo(
    () => savedTemplates.find(template => template.id === currentTemplate?.id),
    [currentTemplate?.id, savedTemplates],
  );

  const effective = useMemo(
    () => currentTemplate ? effectiveTokens(currentTemplate, selectedMode) : {},
    [currentTemplate, selectedMode],
  );

  const tokenKeys = useMemo(
    () => currentTemplate ? allTokenKeys(currentTemplate) : [],
    [currentTemplate],
  );

  const changedKeys = useMemo(
    () => currentTemplate ? diffTemplateTokens(currentTemplate, savedTemplate, selectedMode) : [],
    [currentTemplate, savedTemplate, selectedMode],
  );

  const cssBlock = useMemo(
    () => currentTemplate ? emitTemplateCss({ ...currentTemplate, id: exportTemplateId }, exportTemplateId) : '',
    [currentTemplate, exportTemplateId],
  );

  const refSnippet = useMemo(() => {
    const path = `/embed/hudson/workspace?ref=${encodeURIComponent(refId || exportTemplateId)}`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  }, [exportTemplateId, refId]);

  useEffect(() => {
    if (!templatesLoaded || !currentTemplate || currentTemplate.id !== selectedTemplateId || !visible || disabled) return;
    const root = document.documentElement;
    root.dataset.hudsonTemplate = currentTemplate.id;
    root.dataset.hudsonTheme = selectedMode;

    const tokens = effectiveTokens(currentTemplate, selectedMode);
    const nextKeys = new Set(Object.keys(tokens));
    for (const key of appliedKeysRef.current) {
      if (!nextKeys.has(key)) root.style.removeProperty(key);
    }
    for (const [key, value] of Object.entries(tokens)) {
      if (key === 'color-scheme') root.style.setProperty('color-scheme', value);
      else if (key.startsWith('--')) root.style.setProperty(key, value);
    }
    appliedKeysRef.current = nextKeys;

    return () => {
      for (const key of appliedKeysRef.current) root.style.removeProperty(key);
      appliedKeysRef.current.clear();
    };
  }, [currentTemplate, selectedMode, selectedTemplateId, templatesLoaded, visible, disabled]);

  const setSelectedTemplateId = useCallback((id: string) => {
    setSelectedTemplateIdState(id);
    setExportTemplateIdState(previous => BUILT_IN_TEMPLATE_IDS.includes(id as never) || previous === defaultCustomId(selectedTemplateId)
      ? defaultCustomId(id)
      : previous);
    setRefIdState(previous => previous === defaultCustomId(selectedTemplateId) ? defaultCustomId(id) : previous);
  }, [selectedTemplateId]);

  const setExportTemplateId = useCallback((id: string) => {
    const clean = sanitizeTemplateId(id);
    setExportTemplateIdState(clean);
    setRefIdState(previous => previous ? previous : clean);
  }, []);

  const setRefId = useCallback((id: string) => setRefIdState(sanitizeTemplateId(id)), []);

  const updateToken = useCallback((key: string, value: string) => {
    if (!currentTemplate) return;
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.hudsonTemplate = currentTemplate.id;
      root.dataset.hudsonTheme = selectedMode;
      root.style.setProperty(key, value);
    }
    const next = updateTemplateToken(currentTemplate, selectedMode, key, value);
    setTemplates(previous => replaceTemplate(previous, next));
    setSaveStatus('Unsaved edits');
  }, [currentTemplate, selectedMode]);

  const resetToken = useCallback((key: string) => {
    if (!currentTemplate || !savedTemplate) return;
    const savedValue = effectiveTokens(savedTemplate, selectedMode)[key];
    if (savedValue === undefined) return;
    const next = updateTemplateToken(currentTemplate, selectedMode, key, savedValue);
    setTemplates(previous => replaceTemplate(previous, next));
    setSaveStatus('Token reset');
  }, [currentTemplate, savedTemplate, selectedMode]);

  const copyCss = useCallback(async () => {
    await navigator.clipboard.writeText(cssBlock);
    setSaveStatus('CSS copied');
  }, [cssBlock]);

  const downloadCss = useCallback(() => {
    const blob = new Blob([cssBlock], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportTemplateId}.css`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSaveStatus('CSS file exported');
  }, [cssBlock, exportTemplateId]);

  const importFromCss = useCallback(() => {
    const parsed = parseThemeCss(importCss);
    const imported = parsed.templates[0];
    if (!imported) {
      setSaveStatus('Import needs a data-hudson-template CSS block');
      return;
    }
    setTemplates(previous => replaceTemplate(previous, imported));
    setSelectedTemplateIdState(imported.id);
    setExportTemplateIdState(defaultCustomId(imported.id));
    setRefIdState(defaultCustomId(imported.id));
    setSaveStatus(`Imported ${templateLabel(imported.id)}`);
  }, [importCss]);

  const createCopy = useCallback(() => {
    if (!currentTemplate) return;
    const id = exportTemplateId || defaultCustomId(currentTemplate.id);
    const next = { ...cloneTemplate(currentTemplate), id };
    setTemplates(previous => replaceTemplate(previous, next));
    setSelectedTemplateIdState(id);
    setSaveStatus(`Editing ${templateLabel(id)}`);
  }, [currentTemplate, exportTemplateId]);

  const saveTemplate = useCallback(async () => {
    if (!currentTemplate) return;
    const id = sanitizeTemplateId(exportTemplateId);
    if (!isValidTemplateId(id)) {
      setSaveStatus('Use a kebab-case template id that starts with a letter');
      return;
    }
    if ((BUILT_IN_TEMPLATE_IDS as readonly string[]).includes(id)) {
      setSaveStatus('Built-in ids are read-only; save as a new id');
      return;
    }
    setSaveStatus('Saving tokens.css…');
    const payload = { ...cloneTemplate(currentTemplate), id };
    const response = await fetch('/api/theme-designer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: payload,
        registerRef,
        refId: refId || id,
        defaultTheme: selectedMode,
        defaultWorkspace: 'hudson-os',
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setSaveStatus(data.error || 'Save failed');
      return;
    }
    setTemplates(previous => replaceTemplate(previous, payload));
    setSavedTemplates(previous => replaceTemplate(previous, payload));
    setSelectedTemplateIdState(id);
    setExportTemplateIdState(id);
    setRefIdState(refId || id);
    setSaveStatus(registerRef ? `Saved ${id} + ref preset` : `Saved ${id}`);
  }, [currentTemplate, exportTemplateId, refId, registerRef, selectedMode]);

  const value = useMemo<ThemeDesignerContextValue>(() => ({
    templates,
    savedTemplates,
    selectedTemplateId,
    selectedMode,
    selectedToken,
    selectedGroup,
    exportTemplateId,
    refId,
    registerRef,
    saveStatus,
    importCss,
    isDev,
    currentTemplate,
    savedTemplate,
    effective,
    tokenKeys,
    changedKeys,
    cssBlock,
    refSnippet,
    setSelectedTemplateId,
    setSelectedMode,
    setSelectedToken,
    setSelectedGroup,
    setExportTemplateId,
    setRefId,
    setRegisterRef,
    setImportCss,
    updateToken,
    resetToken,
    copyCss,
    downloadCss,
    importFromCss,
    saveTemplate,
    createCopy,
  }), [
    templates,
    savedTemplates,
    selectedTemplateId,
    selectedMode,
    selectedToken,
    selectedGroup,
    exportTemplateId,
    refId,
    registerRef,
    saveStatus,
    importCss,
    isDev,
    currentTemplate,
    savedTemplate,
    effective,
    tokenKeys,
    changedKeys,
    cssBlock,
    refSnippet,
    setSelectedTemplateId,
    setSelectedMode,
    setSelectedToken,
    setSelectedGroup,
    setExportTemplateId,
    setRefId,
    setRegisterRef,
    setImportCss,
    updateToken,
    resetToken,
    copyCss,
    downloadCss,
    importFromCss,
    saveTemplate,
    createCopy,
  ]);

  return <ThemeDesignerContext.Provider value={value}>{children}</ThemeDesignerContext.Provider>;
}

export function useThemeDesigner() {
  const context = useContext(ThemeDesignerContext);
  if (!context) throw new Error('useThemeDesigner must be used inside ThemeDesignerProvider');
  return context;
}
