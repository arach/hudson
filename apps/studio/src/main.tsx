import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import StudioApp from "./StudioApp";
import { EmbedPage } from "./pages/EmbedPage";
import { subscribePath } from "./router";
import { normalizePath, resolveRoute } from "./router/routes";
import "./styles/tailwind.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

/**
 * Full-bleed surfaces skip the catalog shell:
 *   /embed/*  — bare design surface used by embeds and focused previews
 * Everything else boots the Studio catalog shell.
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

  useEffect(() => {
    if (pathname !== "/paper" && !pathname.startsWith("/paper/")) return;
    const nextPath = pathname.replace(/^\/paper(?=\/|$)/, "/flows");
    window.history.replaceState(
      {},
      "",
      `${nextPath}${window.location.search}${window.location.hash}`,
    );
  }, [pathname]);

  const route = resolveRoute(normalizePath(pathname));

  if (route.kind === "embed") return <EmbedPage slug={route.slug} />;
  return <StudioApp />;
}

createRoot(rootEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
