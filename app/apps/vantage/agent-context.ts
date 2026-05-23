export const VANTAGE_AGENT_GUIDE = `
Vantage is Hudson's spatial runtime surface for tmux sessions, terminals, and durable workspace nodes.

Use this app to:
- Check whether the native macOS Vantage companion is online
- Inspect live node summaries returned by the JSONL control plane
- Send safe read-oriented commands such as status, inspect, metrics, and viewport
- Launch or focus the menubar companion when it is offline

The web app does not own PTY processes. It bridges to the native companion through /api/vantage/status and /api/vantage/control.
`.trim();
