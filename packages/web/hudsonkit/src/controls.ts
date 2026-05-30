'use client';

// hudsonkit/controls — reusable parameter control components for app inspectors.

export {
  ParamSection,
  ParamSlider,
  ParamToggle,
  ParamColor,
  ParamEnum,
  ParamText,
  ParamRepeatable,
  ParamGrid,
} from './components/controls/ParamPanel';

export type {
  ParamSectionProps,
  ParamSliderProps,
  ParamToggleProps,
  ParamColorProps,
  ParamEnumProps,
  ParamTextProps,
  ParamRepeatableProps,
  ParamRepeatableField,
  ParamDefinition,
  ParamGridProps,
} from './components/controls/ParamPanel';

export { CodeViewer } from './components/controls/CodeViewer';
export type { CodeViewerProps, CodeLanguage } from './components/controls/CodeViewer';

export { CodeEditor } from './components/controls/CodeEditor';
export type { CodeEditorProps, DocumentLanguage } from './components/controls/CodeEditor';

export { ObjectCodeSurface, ObjectCodeWorkbench } from './components/controls/ObjectCodeSurface';
export type { ObjectCodeSurfaceProps, ObjectCodeWorkbenchProps } from './components/controls/ObjectCodeSurface';

export {
  TextDocumentProvider,
  TextDocumentSurface,
  TextDocumentSurfaceInner,
  createHudsonTextDocument,
  detectTextDocumentKind,
  inferDocumentLanguage,
  useTextDocument,
} from './components/controls/TextDocument';
export type {
  HudsonTextDocument,
  TextDocumentDetectionInput,
  TextDocumentContextValue,
  TextDocumentKind,
  TextDocumentMode,
  TextDocumentProviderProps,
  TextDocumentSurfaceProps,
} from './components/controls/TextDocument';

export {
  TextDiffSurface,
  createHudsonTextDiff,
} from './components/controls/TextDiff';
export type {
  HudsonTextDiff,
  HudsonTextDiffSnapshot,
  HudsonTextDocumentDiff,
  HudsonTextPatchDiff,
  TextDiffDetectionInput,
  TextDiffLayout,
  TextDiffSurfaceProps,
} from './components/controls/TextDiff';
