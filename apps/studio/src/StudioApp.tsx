import { createElement, type FC } from "react";
import { Compass } from "lucide-react";
import { AppShell } from "hudsonkit/app-shell";
import type { HudsonApp } from "hudsonkit";
import { ThemeProvider } from "hudsonkit/theme";
import { RegistryNav, StudioRouterProvider } from "studio";
import { spaRouter, useRoute } from "./router";
import { registry } from "./registry";
import type { Status } from "./registry";
import { buildEngExtraPages } from "./content";
import { HomePage } from "./pages/HomePage";
import { ExhibitPage } from "./pages/ExhibitPage";
import { EmbedPage } from "./pages/EmbedPage";
import { DocPage } from "./pages/DocPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { flowsApp } from "./flows/FlowsApp";

// Studio sidebar — drops studio's RegistryNav into hudsonkit's SidePanel.
// Path B: hudsonkit owns the panel chrome, studio owns the nav contents.
const STATUS_COLORS: Record<Status, string> = {
  live: "var(--status-ok-fg)",
  draft: "var(--status-warn-fg)",
  placeholder: "var(--status-neutral-fg)",
};

const ENG_EXTRA_PAGES = buildEngExtraPages();

const StudioLeftPanel: FC = () => (
  <RegistryNav
    registry={registry}
    buckets={[
      { key: "foundations" },
      { key: "atoms" },
      { key: "compositions" },
      { key: "proposals" },
    ]}
    extraPages={ENG_EXTRA_PAGES}
    statusColors={STATUS_COLORS}
  />
);

// Content slot — reads current route and dispatches to a page.
// /flows switches to the native canvas app below; embeds remain full-bleed.
const StudioContent: FC = () => {
  const { path, route } = useRoute();
  switch (route.kind) {
    case "home":
      return <HomePage />;
    case "exhibit":
      return <ExhibitPage slug={route.slug} />;
    case "embed":
      return <EmbedPage slug={route.slug} />;
    case "flows":
      return <NotFoundPage path={path} />;
    case "doc":
      return <DocPage slug={route.slug} />;
    case "not-found":
      return <NotFoundPage path={path} />;
  }
};

// Minimal passthrough Provider — studio holds no app-level state of its own;
// router state is global, registry is module-level.
const StudioProvider: FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

const studioApp: HudsonApp = {
  id: "hudson-studio",
  name: "Hudson Studio",
  description: "Internal exploration lab for hudsonkit primitives.",
  mode: "panel",
  leftPanel: {
    title: "Catalog",
    icon: createElement(Compass, { size: 12 }),
  },
  Provider: StudioProvider,
  slots: {
    Content: StudioContent,
    LeftPanel: StudioLeftPanel,
  },
  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: "Ready", color: "emerald" }),
  },
};

export default function StudioApp() {
  return (
    <ThemeProvider>
      <StudioRouterProvider router={spaRouter}>
        <StudioShell />
      </StudioRouterProvider>
    </ThemeProvider>
  );
}

function StudioShell() {
  const { route } = useRoute();
  const isFlows = route.kind === "flows";
  const app = isFlows ? flowsApp : studioApp;

  return (
    <AppShell
      key={app.id}
      app={app}
      assistant={false}
      managedTheme
      chrome={{
        palette: true,
        terminal: false,
        rightPanel: isFlows,
        canvasPanels: isFlows,
      }}
    />
  );
}
