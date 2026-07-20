/**
 * Paper host — ThemeProvider + Frame-owned canvas (HUD chrome).
 */

import { ThemeProvider } from "hudsonkit/theme";
import { PaperStateProvider } from "./PaperState";
import { PaperHost } from "./PaperHost";

// Stable Studio-facing aliases. The package remains the Paper document/MCP
// engine internally while products can present the capability under their own
// durable name without importing implementation files directly.
export { PaperStateProvider as StudioFlowsProvider, usePaperState as useStudioFlowsState } from "./PaperState";
export { PaperWorld as StudioFlowsWorld } from "./PaperWorld";
export { PaperLeftPanel as StudioFlowsLeftPanel } from "./slots/LeftPanel";
export { PaperLeftFooter as StudioFlowsLeftFooter } from "./slots/LeftFooter";
export { PaperInspector as StudioFlowsInspector } from "./slots/Inspector";
export { SettingsTool as StudioFlowsSettings } from "./slots/SettingsTool";
export { usePaperCommands as useStudioFlowsCommands } from "./hooks";
export { MAX_SCALE as STUDIO_FLOWS_MAX_SCALE, MIN_SCALE as STUDIO_FLOWS_MIN_SCALE } from "./types";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" defaultTemplate="hudson">
      <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
        <PaperStateProvider>
          <PaperHost />
        </PaperStateProvider>
      </div>
    </ThemeProvider>
  );
}
