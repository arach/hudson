'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Columns2, FileDiff, Rows3 } from 'lucide-react';
import {
  MultiFileDiff,
  PatchDiff,
  type FileContents,
  type MultiFileDiffProps,
  type PatchDiffProps,
} from '@pierre/diffs/react';
import type { DocumentLanguage } from './CodeEditor';
import type { HudsonTextDocument, TextDocumentDetectionInput } from './TextDocument';
import { createHudsonTextDocument } from './TextDocument';

export type TextDiffLayout = 'split' | 'unified';

type PierreDiffOptions = MultiFileDiffProps<unknown>['options'];

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
  options?: PatchDiffProps<unknown>['options'];
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

const HUDSON_DIFF_CSS = `
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

  useEffect(() => {
    if (layout !== undefined) return;
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
    themeType: 'dark',
    unsafeCSS: HUDSON_DIFF_CSS,
    ...diff.options,
  }), [activeLayout, diff.options]);

  const documentFiles = useMemo(() => {
    if (diff.kind !== 'documents') return null;
    return {
      oldFile: toPierreFile(diff.oldDocument, 'previous'),
      newFile: toPierreFile(diff.newDocument, 'current'),
    };
  }, [diff]);

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden border border-white/[0.06] bg-[#0a0f12] ${className ?? ''}`}>
      {showHeader && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <FileDiff size={13} className="shrink-0 text-cyan-300/55" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-white/78">{diff.title}</div>
            <div className="truncate font-mono text-[10px] uppercase tracking-wider text-white/28">
              {diff.kind === 'patch' ? 'PATCH' : `${fileNameFor(diff.oldDocument)} -> ${fileNameFor(diff.newDocument)}`}
            </div>
          </div>
          <div className="flex rounded border border-white/[0.08] bg-white/[0.03] p-0.5">
            <button
              type="button"
              onClick={() => setLayout('split')}
              className={`rounded px-2 py-1 text-[10px] ${activeLayout === 'split' ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/34 hover:text-white/62'}`}
              title="Split diff"
            >
              <Columns2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setLayout('unified')}
              className={`rounded px-2 py-1 text-[10px] ${activeLayout === 'unified' ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/34 hover:text-white/62'}`}
              title="Unified diff"
            >
              <Rows3 size={12} />
            </button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-[#0a0f12]">
        {diff.kind === 'patch' ? (
          <PatchDiff
            patch={diff.patch}
            options={options}
            disableWorkerPool={disableWorkerPool}
          />
        ) : (
          <MultiFileDiff
            oldFile={documentFiles?.oldFile ?? toPierreFile(diff.oldDocument, 'previous')}
            newFile={documentFiles?.newFile ?? toPierreFile(diff.newDocument, 'current')}
            options={options}
            disableWorkerPool={disableWorkerPool}
          />
        )}
      </div>
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
