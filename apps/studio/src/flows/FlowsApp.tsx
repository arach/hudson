import {
  createStudioFlowsApp,
  type FlowEmbedRegistry,
} from "studio/flows";
import { surfacesBySlug } from "../exhibits/fieldwork/surfaces";
import { navigate } from "../router";

const embeds = Object.fromEntries(
  Object.entries(surfacesBySlug()).map(([slug, component]) => [
    slug,
    { component },
  ]),
) satisfies FlowEmbedRegistry;

export const flowsApp = createStudioFlowsApp({
  id: "hudson-studio-flows",
  embeds,
  discuss: { projectName: "Fieldwork" },
  onNavigateHome: () => navigate("/"),
});
