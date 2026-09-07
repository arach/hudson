# HudsonKit Reference App

This is the reference shape for a normal app that consumes HudsonKit from the
Hudson package, rather than from local source paths.

The important part is the dependency declaration in `Package.swift`:

```swift
.package(url: "https://github.com/arach/hudson.git", branch: "sdk-voice-kit")
```

After HudsonKit is tagged, app packages should switch to a versioned dependency:

```swift
.package(url: "https://github.com/arach/hudson.git", from: "0.1.0")
```

Use this app as the starting point for product apps such as Vox:

- `HAppShell` owns the application frame.
- `HNavigationRail` defines major app sections.
- `HInspector` shows contextual details.
- `HAppManifest` carries app identity and tint.
- Feature modules like `HudsonVoice` mount as normal app-owned screens.

The reference app is intentionally not Vox. It demonstrates the scaffold Vox
can replicate for welcome, configuration, runtime health, and diagnostics.

## Targets

- `HudsonKitReference`: full SwiftUI reference with `HudsonUI`, `HudsonShell`,
  and `HudsonVoice`.
- `HudsonKitShellReference`: shell-only SwiftUI baseline for measuring the
  chassis before optional modules are linked.
- `HudsonKitAppKitReference`: macOS-only AppKit baseline with no SwiftUI or
  HudsonKit imports.

## Verify

```bash
swift build --package-path examples/hudsonkit-reference
swift run --package-path examples/hudsonkit-reference HudsonKitShellReference
```

For memory comparisons, run the script from this directory:

```bash
./scripts/measure-memory.sh
```
