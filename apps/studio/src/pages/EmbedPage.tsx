/**
 * EmbedPage — bare host for a single design surface (Flows map cards + focus).
 *
 * Resolve the surface on each render so registry edits (and Vite HMR) are
 * never stranded behind a module-init snapshot.
 */

import { surfacesBySlug } from "../exhibits/fieldwork/surfaces";

export function EmbedPage({ slug }: { slug: string }) {
  const Surface = surfacesBySlug()[slug];
  if (!Surface) {
    const registered = Object.keys(surfacesBySlug()).join(", ") || "(none)";
    return (
      <main
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: 32,
          color: "#211f1c",
          background: "#ece9e2",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          · 404
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginTop: 8 }}>
          Embed not found
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          No design surface for{" "}
          <code style={{ fontFamily: "ui-monospace, monospace" }}>
            /embed/{slug}
          </code>
          . Registered: {registered}.
        </p>
      </main>
    );
  }
  return <Surface />;
}
