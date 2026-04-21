// @hudson/sdk — public API for app developers.
// Shell internals are in '@hudson/sdk/shell'.

// Types
export type { HudsonApp, AppTool, StatusColor, SearchConfig, AppManifest, AppSettingField, AppSettingsSection, AppSettingsConfig, TakeoverState } from './types/app';
export type { HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation } from './types/workspace';
export type { AppIntent, IntentCategory, IntentParameter, CatalogAppEntry, IntentCatalog } from './types/intent';
export type { ServiceDefinition, ServiceDependency, ServiceRecord, ServiceAction, ServiceStatus } from './types/service';
export type { AppOutput, AppInput, AppPorts, PipeDefinition } from './types/port';
export type { CommandOption, ContextMenuEntry, ContextMenuAction, ContextMenuSeparator, ContextMenuGroup } from './components/overlays';

// Hooks
export { usePersistentState, useDebouncedPersistentState, useSaveIndicator } from './hooks/usePersistentState';
export { useAppSettings } from './hooks/useAppSettings';
export type { AppSettingsValues } from './hooks/useAppSettings';
export { useHudsonAI } from './hooks/useHudsonAI';
export type { HudsonAIChat, UseHudsonAIOptions, AIAttachment } from './hooks/useHudsonAI';
export { useAssistant } from './hooks/useAssistant';
export type { AssistantChat, UseAssistantOptions } from './hooks/useAssistant';
export { useVoiceInput } from './hooks/useVoiceInput';
export type { UseVoiceInputOptions, UseVoiceInputResult } from './hooks/useVoiceInput';
export { useVoiceOutput } from './hooks/useVoiceOutput';
export type { UseVoiceOutputResult, SpeakOptions } from './hooks/useVoiceOutput';
export { ThemeProvider, useTheme, HudsonThemeScript } from './theme';
export type { HudsonTheme, HudsonTemplate, ThemeProviderProps } from './theme';

// Voice types + reply shaping
export type {
  VoiceSettings,
  VoiceStatus,
  VoiceProvider,
  SpokenReplyStyle,
  SpokenReplyLongResponse,
  SpokenReplyCodeResponse,
} from './types/voice';
export { DEFAULT_VOICE_SETTINGS } from './types/voice';
export {
  createHudsonSpokenReply,
  getHudsonMessageDisplayText,
  getHudsonVoiceBehaviorPreset,
  getHudsonVoiceBehaviorPresetLabel,
  getHudsonSpokenReplyStyleLabel,
  applyHudsonVoiceBehaviorPreset,
} from './lib/voiceReply';
export type { HudsonSpokenReplyStyle, HudsonVoiceBehaviorPreset } from './lib/voiceReply';
export { useTerminalRelay } from './hooks/useTerminalRelay';
export type { TerminalRelayHandle, UseTerminalRelayOptions, RelayStatus } from './hooks/useTerminalRelay';

// AI
export { AI } from './components/AI';
export { Assistant } from './components/Assistant';
export { TerminalRelay, captureWorkspace } from './components/TerminalRelay';

// Utilities
export * from './lib/sounds';
export { logEvent, FRAME_LOG_EVENT } from './lib/logger';
export type { FrameLogEntry } from './lib/logger';
export { worldToScreen, screenToWorld } from './lib/viewport';

// Manifest
export { deriveManifest } from './lib/manifest';

// Platform adapter
export type { PlatformAdapter, PlatformLayout } from './platform';
export { WEB_ADAPTER, PlatformProvider, usePlatform, usePlatformLayout } from './platform';

// Reusable widget (used by apps like Shaper directly)
export { ZoomControls } from './components/chrome';
