import { createElement } from 'react';
import { FileCode2 } from 'lucide-react';
import type { HudsonApp } from 'hudsonkit';
import { CodeEditorContent } from './CodeEditorContent';
import { CodeEditorLeftPanel } from './CodeEditorLeftPanel';
import { CodeEditorProvider } from './CodeEditorProvider';
import {
  useCodeEditorCommands,
  useCodeEditorLayoutMode,
  useCodeEditorNavActions,
  useCodeEditorNavCenter,
  useCodeEditorStatus,
} from './hooks';
import { useCodeEditorPortInput, useCodeEditorPortOutput } from './ports';

export const codeEditorApp: HudsonApp = {
  id: 'code-editor',
  name: 'Code Editor',
  description: 'Native Hudson editor for code-viewable objects and editable document payloads',
  mode: 'panel',
  icon: createElement(FileCode2, { size: 15 }),

  Provider: CodeEditorProvider,

  leftPanel: {
    title: 'Code',
    icon: createElement(FileCode2, { size: 12 }),
  },

  ports: {
    inputs: [
      { id: 'document', name: 'Document or Object', dataType: 'json', description: 'Open any Hudson object or document payload as editable code' },
      { id: 'json', name: 'JSON Object', dataType: 'json', description: 'Open structured data as formatted JSON' },
      { id: 'text', name: 'Text', dataType: 'text', description: 'Open text as an editable buffer' },
    ],
    outputs: [
      { id: 'document', name: 'Edited Document', dataType: 'json', description: 'Active document payload, including source metadata' },
      { id: 'json', name: 'Parsed JSON', dataType: 'json', description: 'Active buffer parsed as JSON when valid' },
      { id: 'text', name: 'Source Text', dataType: 'text', description: 'Active buffer as raw text' },
    ],
  },

  slots: {
    Content: CodeEditorContent,
    LeftPanel: CodeEditorLeftPanel,
  },

  hooks: {
    useCommands: useCodeEditorCommands,
    useStatus: useCodeEditorStatus,
    useNavCenter: useCodeEditorNavCenter,
    useNavActions: useCodeEditorNavActions,
    useLayoutMode: useCodeEditorLayoutMode,
    usePortOutput: useCodeEditorPortOutput,
    usePortInput: useCodeEditorPortInput,
  },
};
