import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import StudioApp from "./StudioApp";
import { EmbedPage } from "./pages/EmbedPage";
import PaperPage from "./pages/PaperPage";
import { subscribePath } from "./router";
import { normalizePath, resolveRoute } from "./router/routes";
import "./styles/tailwind.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

/**
 * Full-bleed surfaces skip the catalog shell:
 *   /embed/*  — design page only
 *   /paper    — journey map (Paper inside Studio)
 * Everything else boots the Studio catalog shell.
 *
 * Path is reactive so SPA links from the catalog remount the right root
 * (Paper is not nested under AppShell).
 */
function Root() {
  const [pathname, setPathname] = useState(
    () => window.location.pathname,
  );

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    const unsub = subscribePath(sync);
    window.addEventListener("popstate", sync);
    return () => {
      unsub();
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const route = resolveRoute(normalizePath(pathname));

  if (route.kind === "embed") return <EmbedPage slug={route.slug} />;
  if (route.kind === "paper") return <PaperPage />;
  return <StudioApp />;
}

createRoot(rootEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
