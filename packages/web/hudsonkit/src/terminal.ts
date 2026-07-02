'use client';

export { HUDSON_TERMINAL_CLIENT_CAPABILITIES, useTerminalRelay } from './hooks/useTerminalRelay';
export type {
  RelayStatus,
  TerminalAckMessage,
  TerminalAgent,
  TerminalBackend,
  TerminalControlMode,
  TerminalDataMessage,
  TerminalFlowControlOptions,
  TerminalInputMessage,
  TerminalRelayClientMessage,
  TerminalRelayHandle,
  TerminalRelayOutputAck,
  TerminalRelayOutputHandler,
  TerminalRelayServerMessage,
  TerminalResizeMessage,
  TerminalSessionDetachedMessage,
  TerminalSessionErrorMessage,
  TerminalSessionExitMessage,
  TerminalSessionExpiredMessage,
  TerminalSessionInitMessage,
  TerminalSessionReadyMessage,
  TerminalSessionReconnectMessage,
  UseTerminalRelayOptions,
} from './hooks/useTerminalRelay';
export {
  TerminalRelay,
  captureWorkspace,
  HUDSON_TERMINAL_VOICE_SUBMIT_EVENT,
  HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT,
} from './components/TerminalRelay';
export type {
  HudsonTerminalVoiceTranscriptDetail,
  TerminalColorScheme,
  TerminalRelayConfigItem,
  TerminalRelayProps,
  TerminalRelayRef,
  TerminalRelayTerminalInstance,
  TerminalRendererPreference,
  TerminalRendererState,
} from './components/TerminalRelay';
