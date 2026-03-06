---
title: Guide
description: Local service registry and smart router for discovering and proxying Hudson services.
section: npm
subsection: "@hudsonos/hx"
order: 11
---

# hx -- Service Registry

`@hudsonos/hx` is a local service registry and smart router for Hudson. It runs as a lightweight daemon and lets Hudson discover, query, and proxy requests to any registered service through a single known address.

## Why hx?

Hudson apps and agents run as separate processes -- sometimes on different ports, sometimes on different machines. Without `hx`, Hudson would need to know the exact host and port of every service. With `hx`, services self-register and Hudson queries one endpoint.

```
Agent starts on :4500      ->  registers with hx on :4800
Hudson needs agent data    ->  GET hx:4800/services -> finds agent
Hudson fetches traces      ->  GET hx:4800/proxy/my-agent/traces -> proxied to :4500
```

## Installation

```bash
bun add -g @hudsonos/hx
```

Or run directly via npx:

```bash
npx @hudsonos/hx --help
```

Within the monorepo:

```bash
bun run packages/hx/src/index.ts --help
```

## Daemon Lifecycle

### Starting

```bash
hx up                    # starts on default port 4800
hx up --port 5000        # custom port
```

On startup, the daemon writes its PID to `~/.hx/hx.pid` and loads any previously persisted services from `~/.hx/registry.json`.

### Checking Status

```bash
hx status
```

Prints daemon health, PID, uptime, and service count. If the daemon is not running, reports the status and cleans up any stale PID file.

### Stopping

```bash
hx down
```

Sends `SIGTERM` to the daemon process and removes the PID file.

## Registering Services

### From the CLI

```bash
hx register my-agent \
  --port 4500 \
  --type agent \
  --name "My Agent Server" \
  --endpoints /traces,/chat,/health
```

All flags:

| Flag | Required | Description |
|------|----------|-------------|
| `--port <n>` | Yes | Port the service listens on |
| `--name "..."` | No | Human-readable display name. Defaults to the service ID. |
| `--type <t>` | No | One of `agent`, `app`, `api`, `custom`. Defaults to `custom`. |
| `--endpoints /a,/b` | No | Comma-separated list of endpoint paths the service exposes. |
| `--host <hostname>` | No | Hostname or IP. Defaults to `localhost`. |

### From Your App (HTTP)

Register programmatically by posting to the daemon:

```typescript
await fetch('http://localhost:4800/services', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'my-service',
    port: 3000,
    type: 'api',
    name: 'My API',
    endpoints: ['/api', '/health'],
  }),
});
```

Re-posting with the same `id` updates the existing registration and refreshes `lastSeenAt`.

### Deregistering

```bash
hx deregister my-agent
```

Or via HTTP:

```bash
curl -X DELETE http://localhost:4800/services/my-agent
```

### Service Types

| Type | Use case |
|------|----------|
| `agent` | AI agent servers (inference, tool execution) |
| `app` | Web applications, frontends |
| `api` | Backend API services |
| `custom` | Anything else |

## Discovering Services

### CLI

```bash
hx ls
```

Prints a formatted table of all registered services with their type, host, port, endpoints, and last-seen timestamp.

### HTTP

```bash
# All services
curl http://localhost:4800/services

# Single service
curl http://localhost:4800/services/my-agent
```

Response shape:

```json
{
  "services": [
    {
      "id": "my-agent",
      "name": "My Agent Server",
      "port": 4500,
      "host": "localhost",
      "type": "agent",
      "endpoints": ["/traces", "/chat", "/health"],
      "registeredAt": 1709712000000,
      "lastSeenAt": 1709712000000
    }
  ]
}
```

## Proxying Requests

The `/proxy/:id/*` endpoint routes requests to registered services. Callers only need to know the hx address, not the target port:

```
GET  /proxy/my-agent/traces     ->  GET  localhost:4500/traces
POST /proxy/my-agent/chat       ->  POST localhost:4500/chat
```

All HTTP methods, query strings, and request bodies are forwarded. CORS headers are injected automatically.

```typescript
// Instead of knowing the agent's port:
const res = await fetch('http://localhost:4800/proxy/my-agent/traces');
const data = await res.json();
```

If the target service is not registered, the proxy returns a `404`. If the proxied request fails (service down, connection refused), it returns a `502`.

## Pushing Data to Hudson

`hx push` sends data directly to Hudson's API endpoints using the configured `hudsonUrl`.

### Push a Trace

```bash
# From a file
hx push trace ./output/run-42.json --name "Nightly Run" --agent "my-agent"

# From stdin
my-agent run | hx push trace -
```

Posts to `{hudsonUrl}/api/traces`. The `--name` and `--agent` flags override fields in the trace JSON.

### Push Context

```bash
hx push context ./notes.md --label "Sprint notes"
```

Posts arbitrary content to `{hudsonUrl}/api/context`. Useful for feeding documents, logs, or other data into Hudson.

## Configuration

Configuration lives at `~/.hx/config.json`.

```bash
hx config get                  # show all values
hx config get port             # show a single value
hx config set hudsonUrl http://192.168.1.50:3500
hx config set port 5000
```

| Key | Default | Description |
|-----|---------|-------------|
| `port` | `4800` | Daemon listen port |
| `hudsonUrl` | `http://localhost:3500` | URL of the Hudson instance to push data to |

## File Locations

| Path | Contents |
|------|----------|
| `~/.hx/config.json` | Daemon and Hudson URL configuration |
| `~/.hx/registry.json` | Persisted service registry (survives daemon restarts) |
| `~/.hx/hx.pid` | PID of the running daemon |

## Network Topology

### Single Machine (Development)

```
localhost
+-- Hudson      :3500
+-- hx daemon   :4800
+-- Agent A     :4500   (registered with hx)
+-- Agent B     :4600   (registered with hx)
```

### Multi-Machine (via Tailscale / LAN)

```
Machine A (100.x.x.1)          Machine B (100.x.x.2)
+-- hx daemon :4800             +-- Hudson :3500
+-- Agent     :4500             |   queries hx on 100.x.x.1:4800
+-- Web app   :3000             +-- renders discovered services
```

On Machine A, register services with `--host` set to the LAN/Tailscale IP so Hudson on Machine B can reach them through the proxy.

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Daemon health, uptime, and service count |
| `GET` | `/services` | List all registered services |
| `GET` | `/services/:id` | Single service detail |
| `POST` | `/services` | Register or update a service |
| `DELETE` | `/services/:id` | Deregister a service |
| `*` | `/proxy/:id/*` | Proxy any request to a registered service |

### HxService Type

```typescript
interface HxService {
  id: string;
  name: string;
  port: number;
  host?: string;              // default "localhost"
  type: 'agent' | 'app' | 'api' | 'custom';
  endpoints?: string[];
  meta?: Record<string, unknown>;
  registeredAt: number;       // epoch ms, set on first register
  lastSeenAt: number;         // updated on each re-register
}
```

### HxConfig Type

```typescript
interface HxConfig {
  port: number;        // default 4800
  hudsonUrl: string;   // default "http://localhost:3500"
}
```

### Health Response

```json
{
  "status": "ok",
  "uptime": 120000,
  "services": 3,
  "timestamp": 1709712000000
}
```
