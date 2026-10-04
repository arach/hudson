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

Apps may also declare a `frameworks` array of paths relative to the config file:

```json
{
  "name": "Hudson App",
  "frameworks": ["Build/Release/HudsonRuntime.framework"]
}
```

The packager embeds each framework under `Contents/Frameworks`, adds
`@executable_path/../Frameworks` to the executable's run paths when needed, and
signs the framework's nested code before sealing the assembled app bundle.
If a linker leaves no room for another Mach-O load command, link that rpath into
the executable up front or reserve space with `-headerpad_max_install_names`;
`hkit` reports this condition with the required linker setting.
Universal binaries must carry the framework rpath consistently in every slice.
Framework `LC_ID_DYLIB` values and the app's matching `LC_LOAD_DYLIB` entries
must use `@rpath`; `hkit` rejects absolute build paths before signing and names
the `install_name_tool` repair required upstream.

Apps and embedded helpers may declare a `resources` array of paths relative to
the config file, typically the SwiftPM resource bundles a build produces:

```json
{
  "name": "Hudson App",
  "resources": [".build/release/HudsonApp_HudsonApp.bundle", "assets/notice.txt"]
}
```

Each file or directory is copied to `Contents/Resources/<basename>` before that
bundle is signed, so the signature seals it. Every app and helper's resources
are checked before any bundle is assembled: missing inputs, duplicate basenames,
a resource named `AppIcon.icns` alongside `icon`, and a resource that contains
the output bundle are rejected. Extended attributes are dropped, and a symlink
inside a resource must be relative and stay inside that resource so the shipped
app never points back at the build machine.

Use `--local` for smoke builds that skip notarization and allow ad-hoc signing.
Ad-hoc fallback omits hardened runtime so locally packaged frameworks can load
without a Developer Team ID; identified release signing retains hardened runtime.
An ad-hoc framework signature also preserves only `identifier` metadata, because
carrying identity-bound requirements or runtime flags over from a previous
signature can re-introduce Team ID validation failures.
Use `--sign-identity`, `--require-sign-identity`, and `--notary-profile` for
release builds.
