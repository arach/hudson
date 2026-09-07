import { createElement } from 'react';
import { FileCode2 } from 'lucide-react';
import type { HudsonApp } from '../../index';
import { DocumentLabContent } from './DocumentLabContent';
import { DocumentLabLeftPanel } from './DocumentLabLeftPanel';
import { DocumentLabProvider } from './DocumentLabProvider';
import {
  useDocumentLabCommands,
  useDocumentLabLayoutMode,
  useDocumentLabNavActions,
  useDocumentLabNavCenter,
  useDocumentLabStatus,
} from './hooks';

export const documentLabApp: HudsonApp = {
  id: 'document-lab',
  name: 'Document Lab',
  description: 'Shared text, markdown, and code document primitive',
  mode: 'panel',
  icon: createElement(FileCode2, { size: 15 }),

  Provider: DocumentLabProvider,

  leftPanel: {
    title: 'Files',
    icon: createElement(FileCode2, { size: 12 }),
  },

  slots: {
    Content: DocumentLabContent,
    LeftPanel: DocumentLabLeftPanel,
  },

  hooks: {
    useCommands: useDocumentLabCommands,
    useStatus: useDocumentLabStatus,
    useNavCenter: useDocumentLabNavCenter,
    useNavActions: useDocumentLabNavActions,
    useLayoutMode: useDocumentLabLayoutMode,
  },
};
