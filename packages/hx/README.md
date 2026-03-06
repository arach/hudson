# @hudsonos/hx

Local service registry and smart router for [Hudson](https://github.com/hudsonos/hudson). Zero dependencies, runs on Node 18+.

`hx` is a lightweight daemon that acts as the single point of contact for a machine's services. Agents and apps register with `hx` — Hudson only needs to know where `hx` lives.

```
Machine A (runs agents)                Machine B (runs Hudson)
┌────────────────────────────┐         ┌───────────────────────┐
│  OpenClaw (port 4500)      │         │  Hudson (port 3500)   │
│  Web app  (port 3000)      │         │                       │
│         │                  │         │    queries hx on A    │
│         ▼                  │◄────────┤    to discover apps   │
│  ┌──────────────┐          │         │                       │
│  │  hx :4800    │          │         └───────────────────────┘
│  │  registry:   │          │
│  │   openclaw   │          │
│  │   webapp     │          │
│  └──────────────┘          │
└────────────────────────────┘
```

## Install

```bash
# npm
npm install -g @hudsonos/hx

# or run directly
npx @hudsonos/hx --help
```

## Quick Start

```bash
# 1. Start the daemon
hx up

# 2. Register a service
hx register my-agent --port 4500 --type agent --endpoints /traces,/chat

# 3. Discover services
hx ls
curl http://localhost:4800/services

# 4. Route through hx (resolves port automatically)
curl http://localhost:4800/proxy/my-agent/traces

# 5. Push data to Hudson
hx push trace ./run-output.json --name "My Run"

# 6. Tear down
hx down
```

## How It Works

`hx up` starts an HTTP daemon on port 4800 (configurable). Services register themselves and `hx` maintains an in-memory registry persisted to `~/.hx/registry.json`. Clients query or proxy through `hx` without needing to know individual service ports.

**Registry flow:**
```
Agent starts → POST /services { id: "openclaw", port: 4500 }
Hudson asks  → GET /services → [{ id: "openclaw", port: 4500, type: "agent", ... }]
Hudson calls → GET /proxy/openclaw/traces → proxied to localhost:4500/traces
```

## CLI

### Daemon

| Command | Description |
|---------|-------------|
| `hx up [--port <n>]` | Start daemon (default `:4800`) |
| `hx down` | Stop daemon |
| `hx status` | Health check + service summary |

### Services

| Command | Description |
|---------|-------------|
| `hx register <id> --port <n>` | Register a service |
| `hx deregister <id>` | Remove a service |
| `hx ls` | List all registered services |

**Register options:**

```
--name "Display Name"          Human-readable name
--type agent|app|api|custom    Service type (default: custom)
--endpoints /traces,/chat      Comma-separated endpoint list
--host <hostname>              Override host (default: localhost)
```

### Push

| Command | Description |
|---------|-------------|
| `hx push trace <file>` | Push a trace file to Hudson |
| `hx push context <file>` | Push context data to Hudson |

```bash
# From a file
hx push trace ./trace.json --name "Run #42" --agent "openclaw"

# From stdin
cat trace.json | hx push trace -

# Push context
hx push context ./notes.md --label "Sprint notes"
```

### Config

| Command | Description |
|---------|-------------|
| `hx config get [key]` | Show config (or a specific key) |
| `hx config set <key> <value>` | Update a config value |

```bash
hx config set hudsonUrl http://192.168.1.50:3500
hx config set port 5000
hx config get
```

Config lives at `~/.hx/config.json`:

```json
{
  "port": 4800,
  "hudsonUrl": "http://localhost:3500"
}
```

## HTTP API

All endpoints return JSON. CORS is enabled for all origins.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ status, uptime, services, timestamp }` |
| `GET` | `/services` | List all registered services |
| `GET` | `/services/:id` | Get a single service |
| `POST` | `/services` | Register or update a service |
| `DELETE` | `/services/:id` | Remove a service |
| `*` | `/proxy/:id/*` | Proxy any request to a registered service |

### Register a service (POST /services)

```json
{
  "id": "my-agent",
  "port": 4500,
  "name": "My Agent Server",
  "type": "agent",
  "host": "localhost",
  "endpoints": ["/traces", "/chat", "/health"],
  "meta": { "version": "1.2.0" }
}
```

### Service shape

```typescript
interface HxService {
  id: string;              // unique identifier
  name: string;            // display name
  port: number;            // service port
  host?: string;           // default "localhost"
  type: 'agent' | 'app' | 'api' | 'custom';
  endpoints?: string[];    // known endpoints
  meta?: Record<string, unknown>;
  registeredAt: number;    // epoch ms, set on first register
  lastSeenAt: number;      // epoch ms, updated on re-register
}
```

## Programmatic Usage

You can also register services programmatically from your app:

```typescript
// On startup, register with hx
await fetch('http://localhost:4800/services', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'my-service',
    port: 3000,
    type: 'app',
    endpoints: ['/api', '/health'],
  }),
});

// On shutdown, deregister
await fetch('http://localhost:4800/services/my-service', {
  method: 'DELETE',
});
```

## License

MIT
