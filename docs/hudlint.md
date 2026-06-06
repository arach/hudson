---
title: "HudLint"
description: "Compile-time drift guard for design tokens"
order: 19
section: "Tooling"
---

# HudLint

## Overview

HudLint scans HudsonKit source for raw design values — hardcoded colors, font sizes, padding, frame dimensions, corner radii, opacity literals — and fails the build when it finds them. The token vocabulary (`HudPalette`, `HudSpacing`, `HudRadius`, `HudFont`, `HudTextSize`, `HudLayout`) is the contract; HudLint enforces it.

The motivation is design-system drift: once a `Color(red:0.1, green:0.1, blue:0.12)` or `.padding(13)` lands in one file, the next contributor copies it, and a year later the design system is a folder of conventions nobody reads. **Compile-time enforcement beats convention.** A linter that fails CI is the only thing that holds.

Lives at `packages/native/apple/HudsonKit/Tools/HudLint/` — a standalone Swift Package with two products: `HudLintCore` (library) and `hudlint` (CLI).

## What it catches

Default rules cover five categories:

| Category | Example pattern caught | Use instead |
|----------|-----------------------|-------------|
| `palette` | `Color(red: 0.1, green: 0.1, blue: 0.12)`, `Color.black.opacity(0.4)` | `HudPalette` / `HudTint` / `HudSurface` |
| `typography` | `Font.system(size: 13)` | `HudFont.ui(HudTextSize.sm)` |
| `spacing` | `.padding(12)`, `.padding(.horizontal, 16)` | `HudSpacing.{xs,sm,md,lg,xl,xxl,xxxl,huge}` |
| `geometry` | `.frame(width: 240)`, `.cornerRadius(8)`, `RoundedRectangle(cornerRadius: 12)` | `HudLayout` / `HudRadius` / `HudIconSize` |
| `opacity` | `.opacity(0.4)` | `HudSurface.*` / `HudPalette.*Soft` |

Rules are stateless regexes evaluated line-by-line — see `Sources/HudLintCore/Rules.swift`. The set is intentionally narrow; broader analyses are out of scope for V1.

## macOS integration — Makefile

The macOS demo wires HudLint into the build chain:

```makefile
HUDLINT := $(TOOL_DIR)/.build/release/hudlint

$(HUDLINT):
	@cd $(TOOL_DIR) && swift build -c release --product hudlint

lint: $(HUDLINT)
	@$(HUDLINT) \
		--root $(KIT_ROOT)/Sources \
		--root $(KIT_ROOT)/Demo/HudsonKitDemo \
		--format plain

build: lint
	@swift build
```

`make build` and `make run` both depend on `lint`, so a violation fails the build before `swift build` runs.

## iOS integration — Run Script Build Phase

For the iOS demo, add a Run Script Build Phase ahead of "Compile Sources":

```sh
# HudLint — fail the build on design-token drift
HUDLINT="${SRCROOT}/../HudsonKit/Tools/HudLint/.build/release/hudlint"
if [ ! -x "$HUDLINT" ]; then
  (cd "${SRCROOT}/../HudsonKit/Tools/HudLint" && swift build -c release --product hudlint)
fi
"$HUDLINT" --root "${SRCROOT}/Sources" --format xcode
```

`--format xcode` emits `<file>:<line>:<col>: error: <msg>` so violations appear inline in the Xcode issue navigator.

## Escape hatch

When you genuinely need a raw value, disable the next line:

```swift
// hudlint:disable next-line geometry
.frame(width: 320, height: 44)

// Multiple categories on one line:
// hudlint:disable next-line palette,opacity
Color.black.opacity(0.92)

// Disable everything (rare):
// hudlint:disable next-line
let x = Color(red: 1, green: 0, blue: 0)
```

Directives consume exactly one line and must sit immediately above the offending code.

## Configuration

Path-based ignores live in `.hudlintignore` next to the lint root. Gitignore-flavored — `**` matches any segments, `*` within a segment, leading `/` anchors to root. Generated code and vendored deps belong here.

## CLI

```sh
hudlint --root <dir> [--root <dir> ...] \
        [--config <path>] \
        [--format xcode|plain|json] \
        [--warn] \
        [--quiet]
```

Exit status: `0` clean, `1` violations in strict mode, `2` usage error.
