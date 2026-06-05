export const RUNTIME_AGENT_GUIDE = `
Runtime is Hudson's spatial runtime surface for tmux sessions, terminals, and durable workspace nodes.

Use this app to:
- Check whether the native macOS Runtime companion is online
- Inspect live node summaries returned by the JSONL control plane
- Send safe read-oriented commands such as status, inspect, metrics, and viewport
- Launch or focus the menubar companion when it is offline

The web app does not own PTY processes. It bridges to the native companion through /api/runtime/status and /api/runtime/control.
`.trim();
