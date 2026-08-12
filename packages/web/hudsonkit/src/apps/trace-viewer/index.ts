import { createElement } from 'react';
import { List, ScanSearch } from '../../icons';
import type { HudsonApp, AppManifest } from '../../index';
import { TraceProvider } from './TraceProvider';
import { TraceContent } from './TraceContent';
import { TraceLeftPanel } from './TraceLeftPanel';
import { TraceInspector } from './TraceInspector';
import { useTraceCommands, useTraceStatus } from './hooks';
import { useTracePortOutput } from './ports';

const traceManifest: AppManifest = {
  id: 'trace-viewer',
  name: 'Trace Viewer',
  description: 'Visualize and inspect agent execution traces',
  mode: 'panel',
  commands: [
    { id: 'trace:deselect', label: 'Close current trace' },
  ],
};

export const traceViewerApp: HudsonApp = {
  id: 'trace-viewer',
  name: 'Trace Viewer',
  description: 'Visualize and inspect agent execution traces',
  mode: 'panel',
  manifest: traceManifest,

  ports: {
    outputs: [
      { id: 'selected-trace', name: 'Selected Trace', dataType: 'json', description: 'Full trace object of the selected run' },
      { id: 'step-output', name: 'Step Output', dataType: 'json', description: 'Output of the currently selected step' },
    ],
  },

  leftPanel: {
    title: 'Traces',
    icon: createElement(List, { size: 12 }),
  },
  rightPanel: {
    title: 'Inspector',
    icon: createElement(ScanSearch, { size: 12 }),
  },

  Provider: TraceProvider,

  slots: {
    Content: TraceContent,
    LeftPanel: TraceLeftPanel,
    Inspector: TraceInspector,
  },

  hooks: {
    useCommands: useTraceCommands,
    useStatus: useTraceStatus,
    usePortOutput: useTracePortOutput,
    useLayoutMode: () => 'panel' as const,
  },
};
