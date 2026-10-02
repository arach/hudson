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
