import { spawn, execFile } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type ServiceAction = "check" | "install" | "start" | "stop";

interface ServiceRequest {
  serviceId?: string;
  action?: ServiceAction;
  triggeredBy?: "user" | "agent" | "system";
}

const RELAY_PORT = 3600;
const RELAY_HEALTH_URL = `http://localhost:${RELAY_PORT}/health`;

let relayPid: number | null = null;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body) as Record<string, unknown>;
}

async function relayIsRunning(): Promise<boolean> {
  try {
    const response = await fetch(RELAY_HEALTH_URL, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

function findPidOnPort(port: number): Promise<number | null> {
  return new Promise(resolve => {
    execFile("lsof", ["-ti", `:${port}`], (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const pid = Number(stdout.trim().split("\n")[0]);
      resolve(Number.isFinite(pid) && pid > 0 ? pid : null);
    });
  });
}

async function serviceStatus() {
  return {
    id: "relay",
    name: "Hudson Relay",
    description: "Local WebSocket PTY relay and HTTP upload API owned by the Atelier host.",
    version: "0.1.0",
    icon: "Radio",
    check: { healthUrl: RELAY_HEALTH_URL, port: RELAY_PORT },
    install: { command: "bun install", cwd: "packages/services/hudson-relay" },
    start: { command: "bun run relay" },
    status: (await relayIsRunning()) ? "running" : "not_installed",
  };
}

async function executeRelayAction(action: ServiceAction, triggeredBy: string, hudsonRoot: string) {
  const startedAt = Date.now();
  const logFile = join(process.env.HOME || "/tmp", "hudson", "logs", "atelier-relay.log");

  if (action === "check") {
    return {
      serviceId: "relay",
      action,
      triggeredBy,
      success: true,
      status: (await relayIsRunning()) ? "running" : "not_installed",
      durationMs: Date.now() - startedAt,
    };
  }

  if (action === "install") {
    return {
      serviceId: "relay",
      action,
      triggeredBy,
      success: true,
      status: "installed",
      output: "Relay dependencies are managed by the Hudson workspace install.",
      durationMs: Date.now() - startedAt,
    };
  }

  if (action === "start") {
    if (await relayIsRunning()) {
      return {
        serviceId: "relay",
        action,
        triggeredBy,
        success: true,
        status: "running",
        pid: relayPid ?? (await findPidOnPort(RELAY_PORT)) ?? undefined,
        logFile,
        output: "Service already running",
        durationMs: Date.now() - startedAt,
      };
    }

    mkdirSync(dirname(logFile), { recursive: true });
    const logFd = openSync(logFile, "a");
    appendFileSync(logFd, `\n--- Atelier relay started at ${new Date().toISOString()} ---\n`);

    const child = spawn("bun", ["run", "relay"], {
      cwd: hudsonRoot,
      detached: true,
      env: process.env,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();
    closeSync(logFd);
    relayPid = child.pid ?? null;

    await new Promise(resolve => setTimeout(resolve, 1500));
    const running = await relayIsRunning();
    return {
      serviceId: "relay",
      action,
      triggeredBy,
      success: running,
      status: running ? "running" : "error",
      pid: relayPid ?? undefined,
      command: "bun run relay",
      logFile,
      output: running ? "Started successfully" : "Health check failed after start",
      durationMs: Date.now() - startedAt,
    };
  }

  if (action === "stop") {
    const pid = relayPid ?? (await findPidOnPort(RELAY_PORT));
    if (!pid) {
      return {
        serviceId: "relay",
        action,
        triggeredBy,
        success: false,
        status: "not_installed",
        output: "No running process found",
        durationMs: Date.now() - startedAt,
      };
    }
    process.kill(pid, "SIGTERM");
    relayPid = null;
    return {
      serviceId: "relay",
      action,
      triggeredBy,
      success: true,
      status: "installed",
      pid,
      output: `Sent SIGTERM to PID ${pid}`,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    serviceId: "relay",
    action,
    triggeredBy,
    success: false,
    status: "error",
    output: `Unsupported action: ${action}`,
    durationMs: Date.now() - startedAt,
  };
}

export function atelierHostServicesPlugin({ hudsonRoot }: { hudsonRoot: string }): Plugin {
  return {
    name: "atelier-host-services",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, "http://localhost:3034");

        if (req.method === "GET" && url.pathname === "/api/host/status") {
          sendJson(res, 200, {
            ok: true,
            host: "atelier-local-host",
            workspace: "atelier-workspace",
            services: [await serviceStatus()],
            capabilities: {
              relay: { status: "owned", url: `ws://localhost:${RELAY_PORT}` },
              ai: { status: "not-configured", url: "/api/ai" },
              appApi: { status: "not-configured", url: "/api" },
            },
          });
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/services") {
          sendJson(res, 200, [await serviceStatus()]);
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/services/execute") {
          try {
            const body = (await readJson(req)) as ServiceRequest;
            const { serviceId, action, triggeredBy = "user" } = body;
            if (serviceId !== "relay") {
              sendJson(res, 404, { error: `Unknown service: ${serviceId ?? "(missing)"}` });
              return;
            }
            if (!action || !["check", "install", "start", "stop"].includes(action)) {
              sendJson(res, 400, { error: `Unknown action: ${String(action)}` });
              return;
            }
            const result = await executeRelayAction(action, triggeredBy, hudsonRoot);
            sendJson(res, result.success || action === "check" ? 200 : 500, result);
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/ai/models") {
          sendJson(res, 200, {
            ok: true,
            configured: false,
            providers: [],
            models: [],
            message: "Atelier owns this route; AI provider and tool dispatch adapters are not configured yet.",
          });
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/ai/chat") {
          sendJson(res, 501, {
            ok: false,
            error: "Atelier AI host route exists, but provider/tool dispatch is not configured yet.",
          });
          return;
        }

        // Persistence + telemetry the shell pings on boot. Atelier doesn't
        // persist sessions or ship a log sink yet, so absorb these as no-ops
        // instead of letting them 404 into the console.
        if (url.pathname === "/api/workspace-state") {
          sendJson(res, 200, req.method === "GET" ? {} : { ok: true });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/agent-actions") {
          sendJson(res, 200, { ok: true });
          return;
        }
        if (req.method === "GET" && url.pathname === "/api/settings/environment") {
          sendJson(res, 200, {});
          return;
        }
        // Inter-app data bus (SSE). Atelier has no cross-app pipe broker yet, so
        // hold the stream open and empty rather than 404 + reconnect-storm.
        if (url.pathname === "/api/pipes/stream") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.write(": atelier host has no cross-app pipe broker yet\n\n");
          return;
        }

        next();
      });
    },
  };
}
