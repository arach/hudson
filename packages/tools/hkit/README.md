# hkit

Hudson command-line helpers for design guidance and app packaging.

## macOS Packaging

`hkit package macos` builds Hudson-backed macOS installers from a client-owned
JSON config:

```bash
hkit package macos --config apps/macos/hudson-package.json --local
```

The client config owns product policy: app names, bundle identifiers, build
commands, icons, entitlements, DMG naming, signing environment variables, and
notarization profile. Hudson owns the reusable mechanics: SwiftPM build
execution, `.app` bundle assembly, icon conversion, signing hooks, Finder DMG
layout, generated installer background, and notarization/stapling.

Top-level `apps` are copied into the DMG. Add `embeddedHelpers` to an app when
another app bundle should be built, signed, and nested inside the parent instead
of shown as a separate installer item. Helpers default to
`Contents/Library/LoginItems`.

Use `--local` for smoke builds that skip notarization and allow ad-hoc signing.
Use `--sign-identity`, `--require-sign-identity`, and `--notary-profile` for
release builds.
