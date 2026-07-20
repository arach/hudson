/**
 * Paper journeys map — full-bleed Studio surface.
 *
 * Paper is a Studio capability (not a separate product host). Individual
 * design pages stay as Studio exhibits/embeds; this surface is the map of
 * UX journeys for the active product (Fieldwork).
 */

import PaperApp from "@hudsonkit/paper/host";
import "@hudsonkit/paper/host/styles.css";

export default function PaperPage() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <PaperApp />
    </div>
  );
}
