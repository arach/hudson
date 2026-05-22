// hudsonkit — public API for app developers.
// Shell internals are in 'hudsonkit/shell'.

// Types
export type { HudsonApp, AppTool, StatusColor, SearchConfig, AppManifest, AppSettingField, AppSettingsSection, AppSettingsConfig, TakeoverState, MultiInstanceMode, PortInspectorMode } from './types/app';
export type { HudsonAppBackend } from './types/backend';
export type { HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation, WorkspaceLeftNavigation, AppInstance } from './types/workspace';
export type { AppIntent, IntentCategory, IntentParameter, CatalogAppEntry, IntentCatalog } from './types/intent';
export type { ServiceDefinition, ServiceDependency, ServiceRecord, ServiceAction, ServiceStatus } from './types/service';
export type { AppOutput, AppInput, AppPorts, PipeDefinition } from './types/port';
export type { EmbedSurface, EmbedSizing, AppExports } from './types/embed';
export type { CommandOption, ContextMenuEntry, ContextMenuAction, ContextMenuSeparator, ContextMenuGroup } from './components/overlays';

// Hooks
export { usePersistentState, useDebouncedPersistentState, useSaveIndicator } from './hooks/usePersistentState';
export { InstanceProvider, useInstance, useOptionalInstance } from './context/InstanceContext';
export type { InstanceContextValue } from './context/InstanceContext';
export { useAppSettings } from './hooks/useAppSettings';
export type { AppSettingsValues } from './hooks/useAppSettings';
export { useHudsonAI } from './hooks/useHudsonAI';
export type { HudsonAIChat, UseHudsonAIOptions, AIAttachment } from './hooks/useHudsonAI';
export { useAssistant } from './hooks/useAssistant';
export type { AssistantChat, UseAssistantOptions } from './hooks/useAssistant';
// Voice kit interface (types only — no runtime voice code).
// For actual voice functionality, import from 'hudsonkit/voice'.
export type { AssistantVoiceKit, VoiceKitInput, VoiceKitOutput, VoiceKitSettings } from './types/voice-kit';
export { ThemeProvider, useTheme, HudsonThemeScript } from './theme';
export type { HudsonTheme, HudsonTemplate, ThemeProviderProps } from './theme';
export { useTerminalRelay } from './hooks/useTerminalRelay';
export type { TerminalRelayHandle, UseTerminalRelayOptions, RelayStatus } from './hooks/useTerminalRelay';
export { HLogger, HMetrics, HObservability, HObservabilityDefault, HSpan, HTrace } from './observability';
export type {
  HLogEvent,
  HLogInput,
  HLogLevel,
  HMetricEvent,
  HMetricInput,
  HMetricType,
  HObservabilityOptions,
  HObservation,
  HObservationBase,
  HObservationData,
  HObservationKind,
  HObservationSink,
  HObservationTags,
  HSubscribeOptions,
  HTraceInput,
  HTraceSpan,
  HTraceStatus,
  HUnsubscribe,
} from './observability';

// AI
export { AI } from './components/AI';
export { Assistant } from './components/Assistant';
export {
  TerminalRelay,
  captureWorkspace,
  HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT,
} from './components/TerminalRelay';
export type { HudsonTerminalVoiceTranscriptDetail } from './components/TerminalRelay';

// Utilities
export * from './lib/sounds';
export { logEvent, FRAME_LOG_EVENT } from './lib/logger';
export type { FrameLogEntry } from './lib/logger';
export { worldToScreen, screenToWorld } from './lib/viewport';
export { probeVoxAvailability } from './lib/voxProbe';
export type { VoxAvailability } from './lib/voxProbe';
export { safeLocalStorage, safeSessionStorage } from './lib/safe-storage';
export type { SafeStorage } from './lib/safe-storage';
export { createHudsonId } from './lib/id';

// Manifest
export { deriveManifest } from './lib/manifest';

// App backend (HUD-008)
export { createAppApiClient } from './lib/api/createAppApiClient';
export type {
  AppApiClient,
  AppApiClientAppLike,
  AppApiServiceStatus,
  AppApiStatusStore,
  AppApiStream,
  AppApiStreamEvent,
} from './lib/api/createAppApiClient';
export { useAppApiStatus } from './hooks/useAppApiStatus';
export type { UseAppApiStatusResult } from './hooks/useAppApiStatus';

// Platform adapter
export type { PlatformAdapter, PlatformLayout } from './platform';
export { WEB_ADAPTER, PlatformProvider, usePlatform, usePlatformLayout } from './platform';

// Reusable widget (used by apps like Shaper directly)
export { ZoomControls } from './components/chrome';
export { CanvasToolDock, PanZoomViewport } from './components/canvas';
export type { ViewportPan } from './components/canvas';
export {
  HudWorkflowGraph,
  brainDumpProcessorWorkflow,
  heyTalkieWorkflow,
  hudWorkflowBasicSchema,
  hudWorkflowFixtures,
  quickSummaryWorkflow,
  transcribeWorkflow,
} from './workflow';
export type {
  HudWorkflowConnection,
  HudWorkflowDocument,
  HudWorkflowDocumentMetadata,
  HudWorkflowFieldSchema,
  HudWorkflowFieldType,
  HudWorkflowFixture,
  HudWorkflowNode,
  HudWorkflowNodeTypeSchema,
  HudWorkflowPickerOption,
  HudWorkflowPort,
  HudWorkflowPortRole,
  HudWorkflowSchema,
  HudWorkflowTint,
  HudWorkflowValue,
  HudWorkflowViewport,
} from './workflow';

export {
  CodeEditor,
  CodeViewer,
  TextDocumentProvider,
  TextDocumentSurface,
  TextDocumentSurfaceInner,
  TextDiffSurface,
  createHudsonTextDocument,
  createHudsonTextDiff,
  detectTextDocumentKind,
  inferDocumentLanguage,
  useTextDocument,
} from './controls';
export type {
  CodeEditorProps,
  CodeLanguage,
  CodeViewerProps,
  DocumentLanguage,
  HudsonTextDocument,
  TextDocumentDetectionInput,
  TextDocumentContextValue,
  TextDocumentKind,
  TextDocumentMode,
  TextDocumentProviderProps,
  TextDocumentSurfaceProps,
  HudsonTextDiff,
  HudsonTextDiffSnapshot,
  HudsonTextDocumentDiff,
  HudsonTextPatchDiff,
  TextDiffDetectionInput,
  TextDiffLayout,
  TextDiffSurfaceProps,
} from './controls';
