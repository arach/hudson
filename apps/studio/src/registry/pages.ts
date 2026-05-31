import { createRegistry, type StudioPage } from "studio";
import {
  bucketLabel,
  surfaceLabel,
  SURFACE_ORDER,
  type Bucket,
  type Surface,
  type Status,
} from "./taxonomy";

export type Page = StudioPage<Bucket, Surface, Status>;

export const STUDIO_PAGES: readonly Page[] = [
  {
    href: "/exhibits/theme-tokens",
    label: "Theme Tokens",
    bucket: "foundations",
    surface: "web",
    status: "live",
    blurb: "All --hud-* values, swatched and labeled per template + theme.",
    source: ["packages/web/hudsonkit/src/lib/theme.ts"],
  },
  {
    href: "/exhibits/side-panel",
    label: "SidePanel",
    bucket: "atoms",
    surface: "web",
    status: "live",
    blurb: "Collapsible chrome panel with resize, tabs, and footer slot.",
    source: ["packages/web/hudsonkit/src/components/chrome/SidePanel.tsx"],
  },
  {
    href: "/exhibits/app-shell",
    label: "AppShell",
    bucket: "compositions",
    surface: "web",
    status: "live",
    blurb: "Single-app shell — chrome + panels + content + takeover slots.",
    source: ["packages/web/hudsonkit/src/components/AppShell.tsx"],
  },
  {
    href: "/exhibits/canvas-terminals",
    label: "Canvas + Terminals",
    bucket: "compositions",
    surface: "web",
    status: "draft",
    blurb:
      "Multi-terminal canvas — PanZoomViewport hosting draggable terminal cards.",
    source: [
      "packages/web/hudsonkit/src/components/canvas/PanZoomViewport.tsx",
      "apps/studio/src/exhibits/canvas-terminals/CanvasTerminalsExhibit.tsx",
    ],
  },
  // Engineering material (Proposals + Notes) is auto-discovered from
  // hudson/docs/, hudson/specs/, and packages/native/apple/HudsonKit/Docs/
  // and fed into the registry via `extraPages` from src/StudioApp.tsx.
];

export const registry = createRegistry<Bucket, Surface, Status>({
  pages: STUDIO_PAGES,
  surfaceOrder: SURFACE_ORDER,
  defaultSurface: "web",
  bucketLabel,
  surfaceLabel,
});
