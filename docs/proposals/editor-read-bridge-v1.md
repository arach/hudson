# Editor read bridge v1 — proposed wire contract

Hudson source: `apps/lattices-editor/`. Build: `bun run build:lattices-editor`.
Output: `apps/lattices-editor/dist/` (index.html, editor.js, editor.css). Embed
unchanged under a host-owned WKURLSchemeHandler; no HTTP server or port.

## Transport and envelope

WKScriptMessageHandlerWithReply named `hudsonEditor` accepts a JSON object and
resolves a JSON object. Events arrive via
`globalThis.dispatchEvent(new CustomEvent('hudson:host-event', {detail: envelope}))`.
Host must serialize JSON safely into JavaScript, never interpolate source text.

Every envelope: `{v:1, requestId:string|null, subjectId:string|null,
revision:string|null, kind:string, payload:object}`. Revision is an opaque
content hash, compared for equality, never ordered. Null subject is only legal for capability discovery. Null revision is legal for
capabilities, subject.read and events.subscribe; preview.project requires the
current revision. Request ids are unique within a webview; events have null ids.
Responses echo requestId/subjectId and use `<call>.result`; errors use `error`
and `{code,message}` (`unsupported`, `stale_revision`, `unavailable`, `invalid_request`).
No write/effect methods exist. Unknown methods fail, never fall through.

## Four calls

1. `capabilities`, null subject/revision, `{}` → `capabilities.result`, current
   subjectId/revision, payload:
   `{readOnly:true, methods:['subject.read','preview.project','events.subscribe'],
   subject:{id,kind:'lattices.workspace-layers',label,revision}, terminal:false}`.
2. `subject.read`, bound subject, revision null (read latest), `{}` →
   `subject.read.result`, actual revision, payload `{subject:{id,kind,label,revision},
   source:{text:string,language:'json'}}`. Text is precisely the subset JSON used
   for source offsets below, not independently reserialized by the client.
3. `preview.project`, bound subject, required revision, `{}` →
   `preview.project.result`, same revision, payload:
   `{snapshotId:string, groups:[{id:string,label:string,rows:Row[]}], entries:Entry[]}`.
   Host refuses a stale revision. Include an Unassigned group, even if empty.
   Snapshot changes when inventory changes, independently of config revision.

   `Row = {id:string,windowId:number,app:string,title:string,layerId:string|null,
   entryKeys:string[]}`. Row id is unique across groups within a projection;
   window id need not be. Empty entryKeys is legal (Unassigned/no source entry).

   `Entry = {key:string,layerId:string,canonical:string,
   ranges:[{from:number,to:number}],ambiguous:boolean}`.
   Key is an opaque stable encoding of layer id + canonical content (+ entry
   collection if required to disambiguate pins/saved/match). Canonical is host
   defined; JavaScript does not recompute membership or canonicalization.
   Ranges are zero-based UTF-16 offsets, half-open, into exactly source.text at
   this revision (Swift NSRange semantics). Duplicate canonical entries yield
   ONE key with all occurrence ranges and ambiguous:true. Never choose a
   duplicate by index. Client highlights all candidates and labels ambiguity.
4. `events.subscribe`, bound subject, current revision or null, `{}` →
   `events.subscribe.result`, current revision, `{subscriptionId:string}`.
   Subscribe before initial read. One subscription per webview (idempotent).
   Events may begin before reply; listener must be installed first. Teardown
   with webview lifetime; no fifth unsubscribe call required in slice 1.

## Events and freshness

`config.changed`: bound subject, new revision, null requestId,
`{subscriptionId:string,at:string}` (UTC ISO8601).
`windows.changed`: bound subject, current config revision, null requestId,
`{subscriptionId:string,at:string}`.
Events are delivered in host order. Host registers subscription before taking
its initial state; no startup read/subscribe gap. On any event the client
invalidates pending reads and refetches source + projection, committing them
atomically only if both revisions agree and no newer event arrived. A local
monotonic generation guards inventory-only changes and revision ABA; hashes
alone cannot establish ordering. Config changes append revision/time to History.
A stale_revision retries a fresh read; no mutation is ever retried.

Client validates v/kind/request/subject correlation, reports errors visibly,
and times out missing replies. Missing handler or required capability displays
“Editor unavailable in this Lattices version”. A transient refresh failure
keeps the last consistent view with a visible stale/error notice.

## Agreement points

Please confirm handler name, event ingress, source JSON shape, entry collections,
and UTF-16 offsets before shipping host integration. The host owns all projection
and entry↔row matching. Hudson owns display and generic bridge mechanics.

## Locked with native builder (2026-10-01)

Accepted verbatim by lattices-vivaldi-6 (session-muqausa4-3trl1r).
Subject id `workspace-layers`, kind `lattices.workspace-layers`, label
`Workspace Layers`. source.text is sorted-key pretty JSON
`{kind:"workspace-layers",version:1,layers:[raw layers preserving unknown fields]}`.
Revision is `sha256:<hex>` over sorted-key compact UTF-8 serialization of that
subset. Entry key is `sha256:<hex>` over sorted compact JSON
`{layerId,content:<raw project entry>}`; canonical is compact sorted raw project.
No other collections: pins/match/saved are nested in projects.
Origin: `lattices-editor://bundle/index.html`.
Host checkout: `/Users/arach/dev/lattices-editor-host-slice-1`.

## Amendment 3 — unreadable subject (locked 2026-10-01 21:55)

Capabilities still returns the subject descriptor when the subject cannot be
read, with revision null in both descriptor and envelope. Subscription remains
available. subject.read returns error code unavailable with its diagnostic.
The client shows a recoverable “Can't read workspace layers” notice and the
message; config.changed triggers a reread. After a good read, an invalid edit
may invalidate at the last good revision. Recovery with unchanged content must
also invalidate. A successful read and preview.project still require a non-null
revision. “Editor unavailable in this Lattices version” is reserved for a missing
handler or required capability, not an unreadable document.

## Layers page / native chrome extension (v7)

The `capabilities.result` payload may include `chrome: "host"`. Omission keeps
standalone chrome. Host mode suppresses the web page header, status bar and
peer arrangement/visibility toolbar; panel headers remain. `chrome: "host"`
also advertises support for these two UI-only operations. Neither changes the
workspace configuration, membership or desktop state.

- **`ui.command` event (host → web):** normal v1 event envelope, `requestId: null`,
  `subjectId` equal to the discovered subject and `revision: null` (not a config
  operation). Payload is one of:
  `{ "command": "arrangement", "value": "single"|"columns"|"rows"|"grid" }`,
  `{ "command": "togglePanel", "value": "chat"|"preview"|"history"|"source" }`,
  or `{ "command": "toggleSource" }`. Unknown commands/values and other subject
  IDs are ignored. Commands received after discovery but before panel mounting
  are queued in order (bounded to the most recent 32). Grid uses two columns.
- **`ui.state` request (web → host):** normal correlated v1 request, current
  subject ID, `revision: null`; payload `{ arrangement, panels: string[],
  sourceOpen: boolean }`. `panels` lists enabled (not hidden) panel IDs in saved
  order, including all enabled IDs when arrangement is `single`. `sourceOpen`
  means Source is enabled. Sent on initial mounting/restoration and every layout
  change, including host commands, focus and resize. Requests are serialized.
  Native replies `ui.state.result` with the same request ID and subject ID,
  `revision: null`, `payload: {}`. Errors/timeouts show a recoverable layout-sync
  notice without invalidating configuration data. No `ui.state` is sent in
  standalone mode. The native host must not echo `ui.state` back as a command.

Native Search is outside this extension; no search/filter command is defined.
Narrow presentation never changes persisted wide layout or `ui.state` ordering.
