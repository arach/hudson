import type { ComponentType } from "react";
import { ThemeTokensExhibit } from "./theme-tokens/ThemeTokensExhibit";
import { SidePanelExhibit } from "./side-panel/SidePanelExhibit";
import { AppShellExhibit } from "./app-shell/AppShellExhibit";
import { CanvasTerminalsExhibit } from "./canvas-terminals/CanvasTerminalsExhibit";

// Slug keys must match the page href: `/exhibits/<slug>` in
// src/registry/pages.ts.
export const exhibits: Record<string, ComponentType> = {
  "theme-tokens": ThemeTokensExhibit,
  "side-panel": SidePanelExhibit,
  "app-shell": AppShellExhibit,
  "canvas-terminals": CanvasTerminalsExhibit,
};
