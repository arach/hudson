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

- `HudsonAppShell` owns the application frame.
- `HudsonNavigationRail` defines major app sections.
- `HudsonInspector` shows contextual details.
- `HudsonAppManifest` carries app identity and tint.
- Feature modules like `HudsonVoice` mount as normal app-owned screens.

The reference app is intentionally not Vox. It demonstrates the scaffold Vox
can replicate for welcome, configuration, runtime health, and diagnostics.
