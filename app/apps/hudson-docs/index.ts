import { FileText, Compass, ScanSearch } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from '@hudson/sdk';
import { DocsProvider } from './DocsProvider';
import { DocsContent } from './DocsContent';
import { DocsLeftPanel } from './DocsLeftPanel';
import { DocsRightPanel } from './DocsRightPanel';
import {
  useDocsCommands,
  useDocsStatus,
  useDocsSearch,
  useDocsNavCenter,
  useDocsNavActions,
  useDocsLayoutMode,
} from './hooks';
import { docsIntents } from './intents';

export const hudsonDocsApp: HudsonApp = {
  id: 'hudson-docs',
  name: 'Hudson Docs',
  description: 'Component documentation & explorer',
  mode: 'canvas',
  intents: docsIntents,

  leftPanel: { title: 'Navigation', icon: createElement(Compass, { size: 12 }) },
  rightPanel: { title: 'Inspector', icon: createElement(ScanSearch, { size: 12 }) },

  Provider: DocsProvider,

  slots: {
    Content: DocsContent,
    LeftPanel: DocsLeftPanel,
    Inspector: DocsRightPanel,
    // LeftFooter is handled specially by AppMount (needs shell state)
  },

  hooks: {
    useCommands: useDocsCommands,
    useStatus: useDocsStatus,
    useSearch: useDocsSearch,
    useNavCenter: useDocsNavCenter,
    useNavActions: useDocsNavActions,
    useLayoutMode: useDocsLayoutMode,
  },
};
