# hx — Service Registry

`hx` is Hudson's local service registry and smart router. It runs as a daemon on any machine and lets Hudson discover and communicate with registered services through a single known address.

## Why hx?

Hudson apps and agents run as separate processes — sometimes on different machines. Without `hx`, Hudson would need to know the exact host and port of every service. With `hx`, services self-register and Hudson queries one endpoint.

```
Agent starts on :4500      →  registers with hx on :4800
Hudson needs agent data    →  GET hx:4800/services → finds agent
Hudson fetches traces      →  GET hx:4800/proxy/openclaw/traces → proxied to :4500
```

## Installation

```bash
npm install -g @hudsonos/hx
```

Or within the monorepo:

```bash
bun run packages/hx/src/index.ts --help
```

## Starting the Daemon

```bash
hx up                    # starts on default port 4800
hx up --port 5000        # custom port
hx status                # check if running
hx down                  # stop
```

The daemon stores its PID at `~/.hx/hx.pid` and persists the service registry to `~/.hx/registry.json`.

## Registering Services

### From the CLI

```bash
hx register openclaw \
  --port 4500 \
  --type agent \
  --name "OpenClaw Agent Server" \
  --endpoints /traces,/chat,/health
```

### From your app (HTTP)

```typescript
// Register on startup
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
```

### Service types

| Type | Use case |
|------|----------|
| `agent` | AI agent servers (OpenClaw, custom agents) |
| `app` | Web applications, frontends |
| `api` | Backend API services |
| `custom` | Anything else |

## Discovering Services

```bash
hx ls                                    # CLI table
curl http://localhost:4800/services       # full JSON
curl http://localhost:4800/services/openclaw  # single service
```

## Proxying Requests

The proxy endpoint routes requests to registered services — callers don't need to know the port:

```
GET  /proxy/openclaw/traces     →  GET  localhost:4500/traces
POST /proxy/openclaw/chat       →  POST localhost:4500/chat
```

This works for any HTTP method. Query strings and request bodies are forwarded.

## Pushing Data to Hudson

`hx push` sends data directly to Hudson's API:

```bash
# Push a trace file
hx push trace ./output/run-42.json --name "Nightly Run" --agent "openclaw"

# Pipe from stdin
my-agent run | hx push trace -

# Push context (arbitrary data)
hx push context ./notes.md --label "Sprint notes"
```

This calls Hudson's `/api/traces` and `/api/context` endpoints using the configured `hudsonUrl`.

## Configuration

```bash
hx config get                  # show all
hx config set hudsonUrl http://192.168.1.50:3500
hx config set port 5000
```

Config file: `~/.hx/config.json`

| Key | Default | Description |
|-----|---------|-------------|
| `port` | `4800` | Daemon listen port |
| `hudsonUrl` | `http://localhost:3500` | Hudson instance URL |

## Network Topology

### Single machine (development)

```
localhost
├── Hudson      :3500
├── hx daemon   :4800
├── Agent A     :4500   (registered with hx)
└── Agent B     :4600   (registered with hx)
```

### Multi-machine (via Tailscale / LAN)

```
Machine A (100.x.x.1)          Machine B (100.x.x.2)
├── hx daemon :4800             ├── Hudson :3500
├── Agent     :4500             │   queries hx on 100.x.x.1:4800
└── Web app   :3000             └── renders discovered services
```

Hudson connects to `hx` at the remote address:
```bash
# On Machine B, configure Hudson to find hx on Machine A
# (Hudson reads from its own config, or agents push via hx)
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Daemon health + uptime |
| `GET` | `/services` | List all services |
| `GET` | `/services/:id` | Single service detail |
| `POST` | `/services` | Register/update service |
| `DELETE` | `/services/:id` | Deregister service |
| `*` | `/proxy/:id/*` | Proxy to registered service |

### Service object

```typescript
interface HxService {
  id: string;
  name: string;
  port: number;
  host?: string;              // default "localhost"
  type: 'agent' | 'app' | 'api' | 'custom';
  endpoints?: string[];
  meta?: Record<string, unknown>;
  registeredAt: number;       // epoch ms
  lastSeenAt: number;         // updated on re-register
}
```
