import { WorkspaceShell } from "@app/shell/WorkspaceShell";
import { PlatformProvider } from "hudsonkit";
import { ATELIER_PLATFORM } from "./hostServices";
import { atelierWorkspaces } from "./atelierWorkspaces";

// Transitional full host shell mount. The shell implementation still comes from
// Hudson until it graduates into hudsonkit, but the workspace registry and host
// service URLs are owned by Atelier.
export default function HostView() {
  return (
    <PlatformProvider adapter={ATELIER_PLATFORM}>
      <WorkspaceShell
        workspaces={atelierWorkspaces}
        defaultWorkspaceId="atelier-workspace"
        shellTitle="Atelier"
        bootMode="none"
        persistSession={false}
      />
    </PlatformProvider>
  );
}
