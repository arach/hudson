import type { HudsonWorkspace } from "hudsonkit";
import {
  apiInspectorApp,
  codeEditorApp,
  documentLabApp,
  workflowLabApp,
} from "hudsonkit/apps";
import { shaperApp } from "hudson-showroom";
import { atelierApp } from "./appShellApp";

export const atelierWorkspace: HudsonWorkspace = {
  id: "atelier-workspace",
  name: "Atelier Workspace",
  description: "App-builder workspace for extracted Hudson apps, host services, and bundle contracts.",
  mode: "canvas",
  apps: [
    {
      app: atelierApp,
      canvasMode: "windowed",
      defaultWindowBounds: { x: -720, y: -360, w: 560, h: 560 },
    },
    {
      app: shaperApp,
      canvasMode: "windowed",
      defaultWindowBounds: { x: -80, y: -360, w: 620, h: 640 },
    },
    {
      app: apiInspectorApp,
      canvasMode: "windowed",
      defaultWindowBounds: { x: 620, y: -320, w: 620, h: 480 },
    },
    {
      app: codeEditorApp,
      canvasMode: "windowed",
      defaultWindowBounds: { x: -720, y: 280, w: 760, h: 520 },
    },
    {
      app: documentLabApp,
      canvasMode: "windowed",
      defaultWindowBounds: { x: 120, y: 360, w: 660, h: 480 },
    },
    {
      app: workflowLabApp,
      canvasMode: "windowed",
      defaultWindowBounds: { x: 860, y: 260, w: 680, h: 520 },
    },
  ],
  defaultFocusedAppId: "atelier",
  defaultActivatedAppIds: ["atelier", "shaper", "api-inspector", "code-editor"],
  defaultScale: 0.62,
  defaultPan: { x: 256, y: 110 },
  leftNavigation: "on",
};

export const atelierWorkspaces: HudsonWorkspace[] = [atelierWorkspace];
