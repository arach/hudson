// The full Hudson host shell is still mounted through the Vite `@app` alias
// until WorkspaceShell graduates into hudsonkit. Atelier owns the workspace
// registry and host-service adapter it passes to that shell.
declare module "@app/shell/WorkspaceShell" {
  import type { FC } from "react";
  export const WorkspaceShell: FC<Record<string, unknown>>;
}
