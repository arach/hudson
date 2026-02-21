import { FileText, Compass, ScanSearch } from 'lucide-react';
import { createElement } from 'react';
import type { HudsonApp } from 'frame-ui';
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
  useDocsFrameMode,
} from './hooks';

export const hudsonDocsApp: HudsonApp = {
  id: 'hudson-docs',
  name: 'Hudson Docs',
  description: 'Component documentation & explorer',
  mode: 'canvas',

  leftPanel: { title: 'Navigation', icon: createElement(Compass, { size: 12 }) },
  rightPanel: { title: 'Inspector', icon: createElement(ScanSearch, { size: 12 }) },

  Provider: DocsProvider,

  slots: {
    Content: DocsContent,
    LeftPanel: DocsLeftPanel,
    RightPanel: DocsRightPanel,
    // LeftFooter is handled specially by AppMount (needs shell state)
  },

  hooks: {
    useCommands: useDocsCommands,
    useStatus: useDocsStatus,
    useSearch: useDocsSearch,
    useNavCenter: useDocsNavCenter,
    useNavActions: useDocsNavActions,
    useFrameMode: useDocsFrameMode,
  },
};
