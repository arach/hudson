import type { PlatformAdapter, ServiceDefinition } from "hudsonkit";

export interface AtelierHostServices {
  id: string;
  name: string;
  mode: "local-dev";
  apiBaseUrl: string;
  serviceApiUrl: string;
  relayUrl: string;
  aiApiUrl: string;
  appApiBaseUrl: string;
  services: ServiceDefinition[];
  capabilities: Array<{
    id: string;
    label: string;
    status: "owned" | "adapter" | "not-configured";
    description: string;
  }>;
}

export const ATELIER_RELAY_URL = "ws://localhost:3600";

export const ATELIER_SERVICE_CATALOG: ServiceDefinition[] = [
  {
    id: "relay",
    name: "Hudson Relay",
    description: "Local WebSocket PTY relay and HTTP upload API owned by the Atelier host.",
    version: "0.1.0",
    icon: "Radio",
    check: { healthUrl: "http://localhost:3600/health", port: 3600 },
    install: { command: "bun install", cwd: "packages/services/hudson-relay" },
    start: { command: "bun run relay" },
  },
];

export const atelierHostServices: AtelierHostServices = {
  id: "atelier-local-host",
  name: "Atelier Local Host",
  mode: "local-dev",
  apiBaseUrl: "",
  serviceApiUrl: "",
  relayUrl: ATELIER_RELAY_URL,
  aiApiUrl: "/api/ai",
  appApiBaseUrl: "/api",
  services: ATELIER_SERVICE_CATALOG,
  capabilities: [
    {
      id: "workspace-shell",
      label: "Workspace shell",
      status: "adapter",
      description: "Atelier serves its own workspace declaration while the host shell is still imported from Hudson.",
    },
    {
      id: "relay",
      label: "Relay service",
      status: "owned",
      description: "The Vite host owns /api/services and can start the local Hudson relay.",
    },
    {
      id: "ai-api",
      label: "AI API",
      status: "not-configured",
      description: "Atelier owns the /api/ai route namespace; provider and tool dispatch adapters are next.",
    },
    {
      id: "app-api",
      label: "App APIs",
      status: "not-configured",
      description: "HUD-008 app backend mounting is not wired in this adapter yet.",
    },
  ],
};

export const ATELIER_PLATFORM: PlatformAdapter = {
  titleBarInset: 0,
  dragRegionProps: {},
  onInteractiveMouseDown: undefined,
  isSSR: false,
  apiBaseUrl: atelierHostServices.apiBaseUrl,
  serviceApiUrl: atelierHostServices.serviceApiUrl,
};
