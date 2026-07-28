# hkit

Hudson command-line helpers for design guidance and app packaging.

## macOS Packaging

`hkit package macos` builds Hudson-backed macOS installers from a client-owned
JSON config:

```bash
hkit package macos --config apps/macos/hudson-package.json --local
```

The client config owns product policy: app names, bundle identifiers, build
commands, Hudson feature names, icons, entitlements, DMG naming, signing
environment variables, and notarization profile. Hudson owns the reusable
mechanics: resolving feature names to the build environment SwiftPM needs,
SwiftPM build execution, `.app` bundle assembly, icon conversion, signing hooks,
Finder DMG layout, generated installer background, and notarization/stapling.

Build entries may declare optional Hudson features by name:

```json
{
  "command": "swift",
  "args": ["build", "-c", "release"],
  "features": ["terminal"]
}
```

Known features: `terminal`. `voice` remains accepted as a compatibility no-op
because HudsonVoice is now included in the default package graph; model
acquisition is selected at runtime. Raw `env` remains available as a last-mile
override, but feature selection should prefer `features`.

Top-level `apps` are copied into the DMG. Add `embeddedHelpers` to an app when
another app bundle should be built, signed, and nested inside the parent instead
of shown as a separate installer item. Helpers default to
`Contents/Library/LoginItems`.

Apps may also declare a `frameworks` array of paths relative to the config file.
The packager embeds each framework under `Contents/Frameworks`, adds
`@executable_path/../Frameworks` to the executable's run paths when needed, and
re-signs the framework's nested code with the app identity before sealing the
assembled app bundle.

Use `--local` for smoke builds that skip notarization and allow ad-hoc signing.
Use `--sign-identity`, `--require-sign-identity`, and `--notary-profile` for
release builds.
