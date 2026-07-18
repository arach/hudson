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
  {
    href: "/paper?file=file_f63343493b36",
    label: "Fieldwork · Journeys",
    bucket: "compositions",
    surface: "web",
    status: "live",
    blurb:
      "Paper map inside Studio — Fieldwork UX journeys, design embeds, pick + discuss. Not a separate host.",
    source: [
      "packages/tools/hudson-paper/host/src/PaperHost.tsx",
      "apps/studio/src/pages/PaperPage.tsx",
    ],
  },
  {
    href: "/exhibits/candidate-orientation",
    label: "Candidate · Orientation",
    bucket: "compositions",
    surface: "web",
    status: "live",
    blurb: "Fieldwork prepared desk — embedded on the Paper map.",
    source: ["apps/studio/src/exhibits/fieldwork/CandidateOrientation.tsx"],
  },
  {
    href: "/exhibits/producer-role-world",
    label: "Producer · Role world",
    bucket: "compositions",
    surface: "web",
    status: "draft",
    blurb: "Sketch — compile expired work into a role world.",
    source: ["apps/studio/src/exhibits/fieldwork/ProducerRoleWorld.tsx"],
  },
  {
    href: "/exhibits/producer-mint",
    label: "Producer · Mint",
    bucket: "compositions",
    surface: "web",
    status: "draft",
    blurb: "Sketch — mint a candidate-safe session.",
    source: ["apps/studio/src/exhibits/fieldwork/ProducerMint.tsx"],
  },
  {
    href: "/exhibits/producer-compile",
    label: "Producer · Compile",
    bucket: "compositions",
    surface: "web",
    status: "draft",
    blurb: "Sketch — role-world compiler pipeline.",
    source: ["apps/studio/src/exhibits/fieldwork/ProducerCompile.tsx"],
  },
  // Engineering material (Proposals + Notes) is auto-discovered from
  // hudson/docs/, hudson/docs/specs/, and packages/native/apple/HudsonKit/Docs/
  // and fed into the registry via `extraPages` from src/StudioApp.tsx.
];

export const registry = createRegistry<Bucket, Surface, Status>({
  pages: STUDIO_PAGES,
  surfaceOrder: SURFACE_ORDER,
  defaultSurface: "web",
  bucketLabel,
  surfaceLabel,
});
