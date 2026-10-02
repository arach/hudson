# Read-only Editor flow evidence

Captured by bun run test:lattices-editor:browser using the explicitly enabled
development mock host. All data is synthetic. The labelled development-control
bar is hidden only while capturing; no production content is removed.

Viewport height is 820px. The filename suffix is the width.

| Scenario | Desktop | Narrow |
| --- | --- | --- |
| Starting Chat + Preview | initial-1280.png | initial-640.png |
| Two selected windows, context chips and Source reveal | two-selected-1280.png | two-selected-640.png |
| Duplicate ambiguity and all candidate highlights | ambiguous-1280.png | ambiguous-640.png |
| Expanded layout | expanded-1280.png | expanded-640.png |
| Two History entries | history-two-entries-1280.png | history-two-entries-640.png |
| Preview-first stack | — | narrow-640.png |
| Wide-to-narrow resize | — | narrow-from-wide-640.png |

Narrow selected/history captures scroll the outer stack to show the relevant
panels. Lower panels remain reachable by scrolling; they are not removed.
The app remains read-only. These images do not substitute for WKWebView testing.

## Layers page v7 host mode

`host-main-1280`, `host-expanded-1280`, `host-narrow-640` and
`host-states-{ambiguous,stale,unreadable}-1280` cover the requested board
families. `host-context-source-1280` shows two context chips and Source reveal.
`host-boards-contact-sheet.png` records the side-by-side implementation review.
All are synthetic `?mock=1&host=1` captures; native chrome is intentionally absent.
The remote reference canvas could not be fetched, so this is not a pixel-match
comparison to its boards. No native application was launched.

## Overview v8

- `overview-1280.png`: initial Overview, eight synthetic layers and three open windows.
- `overview-560.png`: picker, single summary column, fully visible disabled composer.
- `overview-to-workspace-1280.png` / `overview-to-workspace-560.png`: after + Preview.

Existing Workspace/States captures were refreshed with the v8 font, palette and lines.
No spatial thumbnail is drawn: the native projection contract supplies no frames.
Reference v8 canvas inaccessible; inspected against the written brief and Talkie's
local workflow-detail.ts/style.css, not against unseen reference pixels.
