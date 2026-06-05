// hudsonkit/workspace — the multi-app host, graduated out of Hudson's app/shell
// into the kit so every client (Hudson, Atelier, …) consumes it instead of
// forking it. Built up in stages: Stage 1 is the foundation contexts; the
// chrome, ports, AI runtime, and the decomposed orchestrator land here next.
export { ActiveWorkspaceProvider, useActiveWorkspace } from './workspace/context/ActiveWorkspaceContext';
