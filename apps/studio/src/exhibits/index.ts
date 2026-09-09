import type { ComponentType } from "react";
import { ThemeTokensExhibit } from "./theme-tokens/ThemeTokensExhibit";
import { SidePanelExhibit } from "./side-panel/SidePanelExhibit";
import { AppShellExhibit } from "./app-shell/AppShellExhibit";
import { CanvasTerminalsExhibit } from "./canvas-terminals/CanvasTerminalsExhibit";
import { CanvasCraftExhibit } from "./canvas-craft/CanvasCraftExhibit";
import { surfacesBySlug } from "./fieldwork/surfaces";

// Design pages only. Spatial product flows live natively at /flows.
export const exhibits: Record<string, ComponentType> = {
  "theme-tokens": ThemeTokensExhibit,
  "side-panel": SidePanelExhibit,
  "app-shell": AppShellExhibit,
  "canvas-terminals": CanvasTerminalsExhibit,
  "canvas-craft": CanvasCraftExhibit,
  ...surfacesBySlug(),
};
