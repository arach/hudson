'use client';

import { createElement, useMemo } from 'react';
import { Braces, FileCode2, Save } from 'lucide-react';
import type { CommandOption, StatusColor } from '../../index';
import { useCodeEditor } from './CodeEditorProvider';

const navButtonClass = 'rounded border border-border/70 bg-card/70 p-1.5 text-muted-foreground transition-colors hover:border-cyan-700/35 hover:bg-cyan-700/10 hover:text-cyan-700 dark:hover:border-cyan-300/20 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200';

export function useCodeEditorCommands(): CommandOption[] {
  const {
    activeDocument,
    createDocument,
    formatActiveJson,
    saveActiveDocument,
    setActiveMode,
  } = useCodeEditor();

  return useMemo<CommandOption[]>(() => [
    {
      id: 'code-editor:new-json',
      label: 'New JSON Buffer',
      section: 'Code Editor',
      action: () => createDocument('json'),
    },
    {
      id: 'code-editor:new-js',
      label: 'New JavaScript Buffer',
      section: 'Code Editor',
      action: () => createDocument('javascript'),
    },
    {
      id: 'code-editor:format-json',
      label: 'Format JSON',
      section: 'Code Editor',
      action: formatActiveJson,
    },
    {
      id: 'code-editor:edit',
      label: activeDocument ? `Edit ${activeDocument.title}` : 'Edit Document',
      section: 'Code Editor',
      action: () => setActiveMode('edit'),
    },
    {
      id: 'code-editor:read',
      label: activeDocument ? `Read ${activeDocument.title}` : 'Read Document',
      section: 'Code Editor',
      action: () => setActiveMode('read'),
    },
    {
      id: 'code-editor:save',
      label: activeDocument ? `Save ${activeDocument.title}` : 'Save Document',
      section: 'Code Editor',
      shortcut: 'Cmd+S',
      action: () => {
        if (activeDocument) saveActiveDocument(activeDocument.value);
      },
    },
  ], [activeDocument, createDocument, formatActiveJson, saveActiveDocument, setActiveMode]);
}

export function useCodeEditorStatus(): { label: string; color: StatusColor } {
  const { activeDocument, activeMode, parseError } = useCodeEditor();
  if (!activeDocument) return { label: 'NO DOC', color: 'neutral' };
  if (parseError) return { label: 'JSON ERROR', color: 'amber' };
  return { label: `${activeDocument.language ?? activeDocument.kind} / ${activeMode}`, color: 'emerald' };
}

export function useCodeEditorNavCenter() {
  const { activeDocument } = useCodeEditor();
  return createElement('span', {
    className: 'font-mono text-[10px] uppercase tracking-wider text-neutral-500',
  }, activeDocument?.mediaType ?? activeDocument?.kind ?? 'code');
}

export function useCodeEditorNavActions() {
  const { activeDocument, createDocument, formatActiveJson, saveActiveDocument } = useCodeEditor();

  return createElement('div', { className: 'flex items-center gap-1.5' }, [
    createElement('button', {
      key: 'new-json',
      type: 'button',
      onClick: () => createDocument('json'),
      className: navButtonClass,
      title: 'New JSON buffer',
    }, createElement(Braces, { size: 13 })),
    createElement('button', {
      key: 'new-js',
      type: 'button',
      onClick: () => createDocument('javascript'),
      className: navButtonClass,
      title: 'New JavaScript buffer',
    }, createElement(FileCode2, { size: 13 })),
    createElement('button', {
      key: 'format',
      type: 'button',
      onClick: formatActiveJson,
      disabled: activeDocument?.language !== 'json',
      className: `${navButtonClass} disabled:pointer-events-none disabled:opacity-35`,
      title: 'Format JSON',
    }, createElement(Braces, { size: 13 })),
    createElement('button', {
      key: 'save',
      type: 'button',
      onClick: () => {
        if (activeDocument) saveActiveDocument(activeDocument.value);
      },
      disabled: !activeDocument || activeDocument.readOnly,
      className: `${navButtonClass} disabled:pointer-events-none disabled:opacity-35`,
      title: 'Save buffer',
    }, createElement(Save, { size: 13 })),
  ]);
}

export function useCodeEditorLayoutMode(): 'focus' {
  return 'focus';
}
