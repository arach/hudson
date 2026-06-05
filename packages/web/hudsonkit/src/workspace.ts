// hudsonkit/workspace — the multi-app host, graduated out of Hudson's app/shell
// into the kit so every client (Hudson, Atelier, …) consumes it instead of
// forking it. Built up in stages: Stage 1 is the foundation contexts; the
// chrome, ports, AI runtime, and the decomposed orchestrator land here next.

// Foundation contexts + runtime services
export { ActiveWorkspaceProvider, useActiveWorkspace } from './workspace/context/ActiveWorkspaceContext';
export {
  DataBusProvider,
  useDataBus,
  useOptionalDataBus,
  usePortActivity,
  usePortBridge,
} from './workspace/context/DataBusContext';
export { ServiceRegistryProvider, useServiceRegistryContext } from './workspace/services/ServiceRegistryContext';
export { useServiceRegistry } from './workspace/services/useServiceRegistry';

// Settings model
export type {
  HudsonSettings,
  FontSettings,
  AIMode,
  VoiceSettings,
  SpokenReplyStyle,
  SpokenReplyLongResponse,
  SpokenReplyCodeResponse,
} from './workspace/settings/types';
