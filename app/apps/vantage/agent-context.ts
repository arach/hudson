export const VANTAGE_AGENT_GUIDE = `
Native Console is Hudson's spatial runtime surface for tmux sessions, terminals, and durable workspace nodes.

Use this app to:
- Check whether the native macOS Hudson app is online
- Inspect live node summaries returned by the JSONL control plane
- Send safe read-oriented commands such as status, inspect, metrics, and viewport
- Launch or focus the native Hudson app when it is offline

The web app does not own PTY processes. It bridges to the native Hudson app through /api/vantage/status and /api/vantage/control.
`.trim();
