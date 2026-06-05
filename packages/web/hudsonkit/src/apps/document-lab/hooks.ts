'use client';

import { createElement, useMemo } from 'react';
import type { CommandOption, StatusColor } from '../../index';
import { useDocumentLab } from './DocumentLabProvider';

export function useDocumentLabCommands(): CommandOption[] {
  const { documents, selectDocument, setActiveMode, activeDocument } = useDocumentLab();

  return useMemo<CommandOption[]>(() => [
    ...documents.map(document => ({
      id: `document-lab:open-${document.id}`,
      label: `Open ${document.title}`,
      section: 'Documents',
      action: () => selectDocument(document.id),
    })),
    {
      id: 'document-lab:edit',
      label: `Edit ${activeDocument.title}`,
      section: 'Document Surface',
      action: () => setActiveMode('edit'),
    },
    {
      id: 'document-lab:read',
      label: `Read ${activeDocument.title}`,
      section: 'Document Surface',
      action: () => setActiveMode(activeDocument.kind === 'markdown' ? 'preview' : 'read'),
    },
  ], [activeDocument, documents, selectDocument, setActiveMode]);
}

export function useDocumentLabStatus(): { label: string; color: StatusColor } {
  const { activeDocument, activeMode } = useDocumentLab();
  return { label: `${activeDocument.kind} · ${activeMode}`, color: 'emerald' };
}

export function useDocumentLabNavCenter() {
  const { activeDocument } = useDocumentLab();
  return createElement('span', {
    className: 'font-mono text-[10px] uppercase tracking-wider text-neutral-500',
  }, activeDocument.mediaType ?? activeDocument.kind);
}

export function useDocumentLabNavActions() {
  const { activeDocument } = useDocumentLab();
  return createElement('span', {
    className: 'font-mono text-[11px] text-neutral-400',
  }, activeDocument.title);
}

export function useDocumentLabLayoutMode(): 'focus' {
  return 'focus';
}
