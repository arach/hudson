'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Columns2, FileDiff, Rows3 } from 'lucide-react';
import type { DocumentLanguage } from './CodeEditor';
import type { HudsonTextDocument, TextDocumentDetectionInput } from './TextDocument';
import { createHudsonTextDocument } from './TextDocument';
import { useOptionalTheme } from '../../theme/ThemeProvider';

export type TextDiffLayout = 'split' | 'unified';

type PierreDiffOptions = Record<string, unknown>;

interface FileContents {
  name: string;
  contents: string;
  lang?: string;
  header?: string;
  cacheKey?: string;
}

interface MultiFileDiffRuntimeProps {
  oldFile: FileContents;
  newFile: FileContents;
  options?: PierreDiffOptions;
  disableWorkerPool?: boolean;
}

interface PatchDiffRuntimeProps {
  patch: string;
  options?: PierreDiffOptions;
  disableWorkerPool?: boolean;
}

const OptionalDiffPeerMissing: React.FC = () => (
  <div className="flex h-full min-h-[180px] items-center justify-center p-6 text-center font-mono text-[11px] text-muted-foreground">
    Text diff rendering requires the optional peer dependency @pierre/diffs.
  </div>
);

const MultiFileDiffLazy = React.lazy(async () => {
  try {
    const mod = await import('@pierre/diffs/react');
    return { default: mod.MultiFileDiff as React.ComponentType<MultiFileDiffRuntimeProps> };
  } catch {
    return { default: OptionalDiffPeerMissing as React.ComponentType<MultiFileDiffRuntimeProps> };
  }
});

const PatchDiffLazy = React.lazy(async () => {
  try {
    const mod = await import('@pierre/diffs/react');
    return { default: mod.PatchDiff as React.ComponentType<PatchDiffRuntimeProps> };
  } catch {
    return { default: OptionalDiffPeerMissing as React.ComponentType<PatchDiffRuntimeProps> };
  }
});

export interface HudsonTextDiffSnapshot {
  title?: string;
  uri?: string;
  language?: DocumentLanguage | string;
  value: string;
  header?: string;
  cacheKey?: string;
}

export interface HudsonTextDocumentDiff {
  id: string;
  title: string;
  kind: 'documents';
  oldDocument: HudsonTextDocument | HudsonTextDiffSnapshot;
  newDocument: HudsonTextDocument | HudsonTextDiffSnapshot;
  layout?: TextDiffLayout;
  options?: PierreDiffOptions;
}

export interface HudsonTextPatchDiff {
  id: string;
  title: string;
  kind: 'patch';
  patch: string;
  layout?: TextDiffLayout;
  options?: PierreDiffOptions;
}

export type HudsonTextDiff = HudsonTextDocumentDiff | HudsonTextPatchDiff;

export interface TextDiffDetectionInput {
  id?: string;
  title?: string;
  oldDocument: TextDocumentDetectionInput;
  newDocument: TextDocumentDetectionInput;
  layout?: TextDiffLayout;
  options?: PierreDiffOptions;
}

export function createHudsonTextDiff(input: TextDiffDetectionInput): HudsonTextDocumentDiff {
  const oldDocument = createHudsonTextDocument(input.oldDocument);
  const newDocument = createHudsonTextDocument(input.newDocument);
  return {
    id: input.id ?? `${oldDocument.id}:${newDocument.id}:diff`,
    title: input.title ?? `${oldDocument.title} diff`,
    kind: 'documents',
    oldDocument,
    newDocument,
    layout: input.layout,
    options: input.options,
  };
}

export interface TextDiffSurfaceProps {
  diff: HudsonTextDiff;
  layout?: TextDiffLayout;
  onLayoutChange?: (layout: TextDiffLayout) => void;
  showHeader?: boolean;
  disableWorkerPool?: boolean;
  className?: string;
}

const HUDSON_DIFF_CSS_DARK = `
:host {
  --diffs-dark-bg: #0a0f12;
  --diffs-dark: rgb(226 240 244 / 0.82);
  --diffs-font-family: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
  --diffs-header-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --diffs-font-size: 12px;
  --diffs-line-height: 19px;
  --diffs-gap-block: 6px;
  --diffs-gap-inline: 8px;
  --diffs-bg-buffer-override: #081014;
  --diffs-bg-context-override: #0c1417;
  --diffs-bg-separator-override: #111c20;
  --diffs-bg-addition-override: rgb(34 197 94 / 0.13);
  --diffs-bg-addition-emphasis-override: rgb(34 197 94 / 0.22);
  --diffs-bg-deletion-override: rgb(248 113 113 / 0.13);
  --diffs-bg-deletion-emphasis-override: rgb(248 113 113 / 0.22);
  --diffs-addition-color: #5eea8a;
  --diffs-deletion-color: #ff7474;
  --diffs-modified-color: #67e8f9;
  color-scheme: dark;
}

[data-diffs-header=default] {
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
  min-height: 34px;
  padding-inline: 12px;
}

[data-code]::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
`;

// Light variant — paper-friendly addition/deletion tints + saturated-mid hue
// for additions/deletions/modified. Reads on cream linen and white surfaces.
const HUDSON_DIFF_CSS_LIGHT = `
:host {
  --diffs-light-bg: #fafaf7;
  --diffs-light: rgb(31 41 55 / 0.92);
  --diffs-font-family: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
  --diffs-header-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --diffs-font-size: 12px;
  --diffs-line-height: 19px;
  --diffs-gap-block: 6px;
  --diffs-gap-inline: 8px;
  --diffs-bg-buffer-override: #fafaf7;
  --diffs-bg-context-override: #f4f3ed;
  --diffs-bg-separator-override: #ebe8df;
  --diffs-bg-addition-override: rgb(21 128 61 / 0.10);
  --diffs-bg-addition-emphasis-override: rgb(21 128 61 / 0.20);
  --diffs-bg-deletion-override: rgb(185 28 28 / 0.10);
  --diffs-bg-deletion-emphasis-override: rgb(185 28 28 / 0.20);
  --diffs-addition-color: #15803d;
  --diffs-deletion-color: #b91c1c;
  --diffs-modified-color: #0e7490;
  color-scheme: light;
}

[data-diffs-header=default] {
  border-bottom: 1px solid rgb(0 0 0 / 0.08);
  min-height: 34px;
  padding-inline: 12px;
}

[data-code]::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
`;

export function TextDiffSurface({
  diff,
  layout,
  onLayoutChange,
  showHeader = true,
  disableWorkerPool = true,
  className,
}: TextDiffSurfaceProps) {
  const [internalLayout, setInternalLayout] = useState<TextDiffLayout>(layout ?? diff.layout ?? 'split');
  const activeLayout = layout ?? internalLayout;

  // Pick the diff theme to match the active hudson theme. Provider may be
  // absent (SSR / unwired previews) — fall back to dark in that case.
  const themeContext = useOptionalTheme();
  const isLight = themeContext?.resolvedTheme === 'light';

  useEffect(() => {
    if (layout !== undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs uncontrolled layout to the incoming diff when it changes (only in uncontrolled mode); bounded derived-state sync, not a cascade
    setInternalLayout(diff.layout ?? 'split');
  }, [diff.id, diff.layout, layout]);

  const setLayout = (nextLayout: TextDiffLayout) => {
    if (layout === undefined) setInternalLayout(nextLayout);
    onLayoutChange?.(nextLayout);
  };

  const options = useMemo<PierreDiffOptions>(() => ({
    diffStyle: activeLayout === 'split' ? 'split' : 'unified',
    diffIndicators: 'bars',
    hunkSeparators: 'line-info-basic',
    lineDiffType: 'word-alt',
    overflow: 'wrap',
    themeType: isLight ? 'light' : 'dark',
    unsafeCSS: isLight ? HUDSON_DIFF_CSS_LIGHT : HUDSON_DIFF_CSS_DARK,
    ...diff.options,
  }), [activeLayout, diff.options, isLight]);

  const documentFiles = useMemo(() => {
    if (diff.kind !== 'documents') return null;
    return {
      oldFile: toPierreFile(diff.oldDocument, 'previous'),
      newFile: toPierreFile(diff.newDocument, 'current'),
    };
  }, [diff]);

  // Wrapper bg is driven by --hud-diff-surface-bg ([data-hudson-theme] in
  // tokens.css), not isLight. resolvedTheme is undefined during SSR/hydration
  // by design, so a JS-driven style would diverge from the server HTML.
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden border border-border/60 ${className ?? ''}`}
      style={{ backgroundColor: 'var(--hud-diff-surface-bg, #0a0f12)' }}
    >
      {showHeader && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
          <FileDiff size={13} className="shrink-0 text-cyan-700/70 dark:text-cyan-300/55" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-foreground/86">{diff.title}</div>
            <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {diff.kind === 'patch' ? 'PATCH' : `${fileNameFor(diff.oldDocument)} -> ${fileNameFor(diff.newDocument)}`}
            </div>
          </div>
          <div className="flex rounded border border-border/60 bg-card/60 p-0.5">
            <button
              type="button"
              onClick={() => setLayout('split')}
              className={`rounded px-2 py-1 text-[10px] ${activeLayout === 'split' ? 'bg-cyan-700/15 dark:bg-cyan-400/15 text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground hover:text-foreground/72'}`}
              title="Split diff"
            >
              <Columns2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setLayout('unified')}
              className={`rounded px-2 py-1 text-[10px] ${activeLayout === 'unified' ? 'bg-cyan-700/15 dark:bg-cyan-400/15 text-cyan-700 dark:text-cyan-200' : 'text-muted-foreground hover:text-foreground/72'}`}
              title="Unified diff"
            >
              <Rows3 size={12} />
            </button>
          </div>
        </div>
      )}
      <div
        className="min-h-0 flex-1 overflow-auto"
        style={{ backgroundColor: 'var(--hud-diff-surface-bg, #0a0f12)' }}
      >
        <Suspense fallback={<DiffLoading />}>
          {diff.kind === 'patch' ? (
            <PatchDiffLazy
              patch={diff.patch}
              options={options}
              disableWorkerPool={disableWorkerPool}
            />
          ) : (
            <MultiFileDiffLazy
              oldFile={documentFiles?.oldFile ?? toPierreFile(diff.oldDocument, 'previous')}
              newFile={documentFiles?.newFile ?? toPierreFile(diff.newDocument, 'current')}
              options={options}
              disableWorkerPool={disableWorkerPool}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

function DiffLoading() {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center font-mono text-[11px] text-muted-foreground">
      Loading diff viewer…
    </div>
  );
}

function toPierreFile(document: HudsonTextDocument | HudsonTextDiffSnapshot, cachePrefix: string): FileContents {
  const name = fileNameFor(document);
  return {
    name,
    contents: document.value,
    lang: toPierreLanguage(document.language),
    header: 'header' in document ? document.header : undefined,
    cacheKey: 'cacheKey' in document && document.cacheKey
      ? document.cacheKey
      : `${cachePrefix}:${name}:${document.value.length}:${hashString(document.value)}`,
  };
}

function fileNameFor(document: HudsonTextDocument | HudsonTextDiffSnapshot) {
  return document.uri?.split('/').pop() ?? document.title ?? 'Untitled';
}

function toPierreLanguage(language: HudsonTextDocument['language'] | HudsonTextDiffSnapshot['language']) {
  if (!language) return undefined;
  if (language === 'plain') return 'text';
  if (language === 'shell') return 'bash';
  return language;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return hash.toString(36);
}
