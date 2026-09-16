# Embedded terminal worker

Scout consumes `HudTerminalIPCSession` and its AppKit `HudTerminalIPCView` from
HudsonTerminal. The normal Scout bundle embeds this worker as an XPC service;
there is one service process per host application, with up to 16 sessions. It
is not a launch agent or a separately installed application.

Build through `build.ts OUTPUT HOST_IDENTIFIER HOST_TEAM`. Both
`HUDSON_GHOSTTY_XCFRAMEWORK` and `HUDSON_GHOSTTY_BUILD_PROVENANCE` are required.
The compiler and SDK follow the selected Xcode toolchain through `xcrun`;
`HUDSON_MACOS_SDK` can select a validated older SDK without raising the macOS
26.0 deployment target. The builder verifies the native library SHA-256 before linking and emits a
Release-optimized binary, XPC Info.plist and engine receipt. The host packager
signs the service before signing the outer app. Both sides require the peer's
code signature: the client uses the embedded helper's designated requirement;
the helper requires the configured host identifier and Developer ID team.

All PTY I/O, parser state, scrollback and Ghostty rendering live in the helper.
The host imports BGRA IOSurfaces and submits a fullscreen Metal draw on a private
queue, with no pixel readback, text polling or per-frame SwiftUI updates. A frame
lease is released only after consumer GPU completion. The helper's global export
allocation cap is 288 MiB, including retiring pools. Each session has three
active buffers and at most one retiring pool. Further resizes coalesce until old
leases drain. The newest completed generation wins; terminal bytes are never
coalesced or discarded. The cap covers export buffers, not engine/GPU/PTY memory.

Input uses ordered sequence numbers and one acknowledged request at a time per
session. The host bounds queued input to 1 MiB; individual wire messages are
bounded to 64 KiB. Oversized input is explicitly rejected without killing the
session. Input arriving during startup is buffered under the same caps and
flushed only after the helper and presentation pipeline are ready. Clipboard reads happen only for explicit host paste, and clipboard
writes happen only for explicit host copy. Arbitrary terminal clipboard escape
sequences do not access the system clipboard.

A retained session survives view reparenting and navigation. The hub retains
only weak host session references; dropping the last owner closes the worker
session after outstanding GPU work drains. Hidden sessions
continue processing PTY output but stop exporting frames. Helper interruption
reports a stopped session; commands are never automatically reexecuted.

## Validation and current limits

The installed normal Scout app is the live consumer. Verify fresh shell input,
paste, PTY `stty size` changes on resize, tmux attachment, navigation/reparenting,
shutdown and a single helper serving all panes. Compiler and signed-bundle
receipts are retained with the host release evidence. The earlier isolated probe
remains a regression fixture for lease ownership and stalled-main presentation.

The initial integration uses the startup font preferences; runtime font/theme
updates and full terminal-content accessibility need follow-up. IME candidate
placement currently anchors to the terminal view. No performance parity or
scanout-latency claim follows from these correctness checks.


### Session lifecycle regression

Compile `SessionTests.swift` with the four IPC source files using
`-D HUDSON_TERMINAL_IPC_TESTING -parse-as-library`, then run the result.
This injects an in-memory service only in that test build: it opens no PTYs or
XPC helpers. It delays startup to check ordered input buffering, releases the
last owner to check worker-close delivery, and stops before a late open reply
to ensure queued text is discarded. Normal library builds exclude the hooks.
