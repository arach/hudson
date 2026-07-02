# HUD-007: Native Workflow Kit

## Status

Proposed as a parity-first HudsonKit component effort.

## Context

Talkie has an older standalone Swift package named WFKit:

`/Users/arach/dev/talkie/packages/swift/WFKit`

WFKit is a native SwiftUI workflow/node editor. It includes a canvas, nodes,
ports, connections, schema-driven inspector fields, minimap, undo/redo, and a
demo app. It was built as a separate exploratory project, but the useful part
is not that it is a standalone product. The useful part is the workflow editor
primitive.

Talkie's current workflow definitions have also moved on from the old TWF spec.
The important current shapes are:

- **Human-authored flat JSON workflow files** in Talkie resources and live
  config, for example `Resources/WorkflowTemplates/quick-summary.json`.
- **Portable workflow definitions** in `workflow-core`, normalized into
  `PortableWorkflow` and `PortableWorkflowStep`.
- **Native `WorkflowDefinition` / `WorkflowStep` models** in Talkie macOS,
  where steps have a type, typed config, output key, enabled flag, and optional
  condition.

The old `TWF_SPEC.md` remains useful as historical context, but it is not the
source of truth for the next integration.

Talkie still accepts and persists full native `WorkflowDefinition` JSON as
well as flat JSON. The native repository should remain the source of truth for
Talkie app persistence; HudsonWorkflow should be able to visualize both native
and portable forms without assuming the flat JSON template is the only persisted
shape.

## Decision

Bring the workflow editor into HudsonKit native as a reusable component:

```text
HudsonWorkflow
```

WFKit is the donor. HudsonWorkflow is the recipient.

The component should be designed as a first-class Hudson primitive with both
web and native implementations before deeper Talkie adapter work proceeds. The
native implementation is important because Talkie is a macOS app, but the
workflow surface should not become a native-only one-off. Hudson web should have
the same document/schema vocabulary and a reference renderer so workflow graphs
can eventually move through Hudson spaces the same way other Hudson app
surfaces do.

Talkie remains its own standalone macOS app. It should eventually embed the
native workflow component, not move into a Hudson web workspace and not depend
on the old standalone WFKit package forever.

The standalone WFKit package should be retired only after the new native
component has enough parity for Talkie to use it directly.

## Donor / Recipient Split

WFKit donates:

- graph document state
- node, port, and connection concepts
- pan/zoom canvas behavior
- node selection and dragging
- connection routing and waypoints
- graph-aware minimap
- schema-driven inspector fields
- read-only vs editable modes
- import/conversion lessons from Talkie workflows

HudsonWorkflow owns:

- public API naming
- HudsonUI visual language
- web/native component parity
- package target boundaries
- shell integration
- document/schema model
- host-owned persistence
- future web/native vocabulary parity

Talkie owns:

- product-specific workflow definitions
- workflow execution
- memo/transcript inputs
- allowed commands and privileged actions
- remote queue/control-plane behavior
- user preferences, pinning, auto-run, and live config

## Web / Native Parity Gate

Before the Talkie adapter work gets serious, HudsonWorkflow should establish a
small parity contract across web and native.

Parity means:

- one shared conceptual document shape: document metadata, nodes, ports,
  connections, viewport, selection, typed field values, and adapter-owned
  sidecars
- one shared schema vocabulary: node type id, label, category, icon, tint,
  default ports, field schemas, and port labels
- shared fixture workflows used by both implementations
- matching user-visible semantics for read-only graph viewing, selection,
  connection labels, output keys, disabled states, and condition summaries
- matching Hudson visual language: cyan/blue/teal/emerald/amber/neutral, no
  WFKit purple/pink defaults

Parity does not mean identical implementation internals. The web side should
reuse HudsonKit web canvas primitives such as `Canvas`, `PanZoomViewport`, and
`Minimap` where they fit. The native side should reuse `HudAppShell`,
`HudCanvas`, `HudInspector`, and eventually the Canvas canvas lessons where
they are genuinely useful.

The first proof should be a read-only workflow lab on both sides that renders
the same fixture documents. Editing, Talkie persistence, and runtime execution
should wait until the parity contract is boring and obvious.

## Talkie Review Notes

A Codex-backed Talkie review validated the direction and added a few concrete
constraints for the next slices:

- Flat JSON is the preferred human/agent authoring shape, but Talkie also
  accepts and persists full native `WorkflowDefinition` JSON.
- `WorkflowDefinition` carries UUIDs, source, timestamps, `autoRunOrder`, and
  other native metadata. Pinned/auto-run/sort behavior may also be merged from
  workflow config/preferences, so root workflow JSON alone is not the complete
  user-visible state.
- Current step IDs should come from Talkie's raw step vocabulary, for example
  `llm`, `transcribe`, `iOSPush`, `appleReminders`, and `cloudUpload`. Old TWF
  labels and stale WFKit schema names are not canonical.
- Conditional declarations need careful presentation. Talkie has
  `thenSteps` / `elseSteps` in workflow config, while `workflow-core` currently
  executes workflows linearly and treats `conditional` as a boolean-producing
  step; step-level `condition` controls skipping. HudsonWorkflow may visualize
  branches, but should not imply runtime branch parity until Talkie's runtime
  catches up.
- The old WFKit `TalkieWorkflowSchema` should be treated as donor context, not
  as the source for current Talkie field names. For example, transcribe should
  map current `qualityTier` / `fallbackStrategy` fields rather than old `model`
  fields.

## Current Talkie Workflow Shape

Human-authored workflow JSON is intentionally flat:

```json
{
  "name": "Quick Summary",
  "description": "Generate a concise executive summary",
  "icon": "list.bullet.clipboard",
  "color": "blue",
  "steps": [
    {
      "type": "llm",
      "outputKey": "summary",
      "provider": "gemini",
      "modelId": "gemini-2.0-flash",
      "prompt": "Summarize: {{TRANSCRIPT}}"
    }
  ]
}
```

`workflow-core` normalizes this into:

```ts
interface PortableWorkflow {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  maintainer?: string | null;
  isEnabled: boolean;
  isPinned: boolean;
  autoRun: boolean;
  steps: PortableWorkflowStep[];
}
```

Each normalized step has:

- `id`
- `type`
- `outputKey`
- `isEnabled`
- optional `condition`
- normalized `config`

HudsonWorkflow should treat this as the relevant adapter target, not TWF.

## Workflow Document Model

HudsonWorkflow should use a graph document model internally:

```swift
@Observable
public final class HudWorkflowDocument: Codable {
    public var id: String
    public var title: String
    public var metadata: HudWorkflowDocumentMetadata
    public var nodes: [HudWorkflowNode]
    public var connections: [HudWorkflowConnection]
    public var viewport: HudWorkflowViewportState
    public var selectedNodeIDs: Set<String>
}
```

This is an editor representation, not Talkie's runtime source of truth.

The model must preserve enough data for a read-only adapter to be lossless:

- document-level source metadata such as source format, source id, source path,
  slug, native UUID, icon, color, maintainer, enabled/pinned/auto-run
  preferences, timestamps, and adapter-owned sidecars
- node-level `outputKey`, enabled state, optional condition, source step id,
  step index, and raw config when needed
- typed field values, not only strings, because Talkie configs include
  booleans, numbers, arrays, dictionaries, and nested objects

Talkie adapters should convert:

```text
flat JSON / PortableWorkflow / WorkflowDefinition
    -> HudWorkflowDocument
    -> edited workflow data
    -> Talkie-owned workflow persistence
```

## Schema Model

Keep WFKit's most important architectural idea: schema and instance are
separate.

The workflow instance stores node positions, connections, selected nodes, and
field values. The schema tells the editor what node types exist and how fields
should render.

```swift
public protocol HudWorkflowSchemaProvider: Sendable {
    var nodeTypes: [HudWorkflowNodeTypeSchema] { get }
    func schema(for nodeTypeID: String) -> HudWorkflowNodeTypeSchema?
}
```

Talkie can provide a schema generated from its step catalog and typed
`WorkflowStep.StepType` vocabulary.

## Package Shape

Add a native HudsonKit product:

```swift
.library(name: "HudsonWorkflow", targets: ["HudsonWorkflow"])
```

Target dependencies:

```swift
HudsonWorkflow -> HudsonUI, HudsonShell, HudsonObservability
```

Add a matching web package surface under HudsonKit web:

```text
packages/web/hudsonkit/src/workflow/
```

The web side should export the same conceptual types and a read-only renderer
first. It can be hosted inside a Hudson app/workspace as a workflow lab for
fixture comparison, tuning, and screenshots.

Initial layout:

```text
Sources/HudsonWorkflow/
  Models/
  Canvas/
  Inspector/
  Shell/
  Adapters/
```

Adapters should be optional or host-owned. The core package should not import
Talkie.

## First Slice

The first accepted slice is deliberately small and parity-focused:

- shared document/schema contract in prose and code on both web and native
- fixture documents that model Talkie-like linear, conditional, disabled, and
  output-key-heavy workflows without importing Talkie code
- web read-only workflow renderer hosted in a Hudson workflow lab app
- native read-only `HudWorkflowCanvas` / `HudWorkflowEditor`
- parity notes for what each side renders and what remains intentionally absent

No Talkie product integration yet.
No TWF importer yet.
No save-back editing yet.

Initial web-side files:

```text
packages/web/hudsonkit/src/workflow/
  types.ts
  fixtures.ts
  WorkflowGraph.tsx
  index.ts

app/apps/workflow-lab/
```

The Workflow Lab app is the first visual proof harness. It renders shared
fixture documents with the web renderer, exposes fixture selection, and shows
document/node metadata in the inspector. Native should match these fixtures
before the Talkie adapter spike starts.

## Follow-Up Slices

1. **Parity foundation**
   Establish the shared document/schema vocabulary, fixture workflows, and
   read-only web/native renderers. This is the gate before adapter work.

2. **Round-trip data foundation**
   Add typed workflow values, document metadata, node `outputKey`, node enabled
   state, and explicit condition storage so current Talkie workflows can be
   imported without loss.

3. **Read-only Talkie adapter spike**
   Convert current Talkie `WorkflowDefinition` into `HudWorkflowDocument` as the
   primary app path, and `PortableWorkflow` into `HudWorkflowDocument` for
   flat/server parity tests. Start read-only: no save-back, no TWF importer.
   Validate against fixtures such as `quick-summary`, `brain-dump-processor`,
   `hey-talkie`, and `transcribe`.

4. **Inspector parity**
   Bring over schema-driven field editors from WFKit, including picker,
   boolean, slider, text, multiline text, object arrays, string arrays, and
   key-value arrays.

5. **Connection editing**
   Add port drag, validation, reconnection, deletion, and conditional branch
   labeling.

6. **Minimap and layout**
   Bring in the graph-aware minimap and layout modes, translated to HudsonUI.

7. **Talkie embedding**
   Replace Talkie's WFKit usage with HudsonWorkflow inside the macOS app.

8. **WFKit retirement**
   Archive or remove the standalone WFKit package once Talkie no longer depends
   on it and useful donor behavior has landed in HudsonWorkflow.

## Non-Goals

- Do not make Talkie a Hudson web app for this phase.
- Do not revive TWF as the canonical workflow format.
- Do not move Talkie's workflow execution into HudsonWorkflow.
- Do not import Talkie product code into HudsonWorkflow.
- Do not make the native implementation the only canonical implementation.
- Do not preserve WFKit's old purple/pink defaults as Hudson defaults.

## Design Notes

HudsonWorkflow should use HudsonUI tokens. Host apps may map their own workflow
colors into `HudTint`, but the component itself should default to Hudson's
cyan, blue, teal, emerald, amber, and neutral vocabulary.

The graph editor should be useful outside Talkie. Talkie is the first real host,
not the package boundary.

## Open Questions

- Should Talkie own all adapters in its app target, or should HudsonWorkflow
  include a generic `PortableWorkflow` adapter that mirrors `workflow-core`?
- Should the editor round-trip flat workflow JSON directly, or should it only
  round-trip a normalized portable form?
- Which pieces of Canvas canvas math should be shared with HudsonWorkflow now,
  and which should wait until the workflow canvas proves its own needs?
- Should workflow execution traces become a separate HudsonLive source attached
  to the graph later?
