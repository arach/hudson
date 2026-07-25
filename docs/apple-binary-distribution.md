# Apple Binary Distribution

Hudson's native Apple package can be released as SwiftPM binary targets so a
public downstream app can depend on Hudson UI modules without vendoring Hudson
source.

## Package shape

Use one public binary Swift package, `arach/hudsonkit-xcframework`.
That package's manifest contains multiple `.binaryTarget` entries, but the
consumer sees a single package dependency with the `HudsonUI` and `HudsonShell`
products.

The multiple binary targets are required because SwiftPM binary targets cannot
declare their own transitive dependencies. The product target lists provide the
closure Swift needs at compile/link time while keeping every module prebuilt.

Default shape:

- Swift packages: 2 total (`Hudson` source package, `HudsonKitXCFramework` public
  binary package)
- Public products in `HudsonKitXCFramework`: 2 (`HudsonUI`, `HudsonShell`)
- Binary targets/artifact zips today: 4 (`HudsonLive`, `HudsonObservability`,
  `HudsonUI`, `HudsonShell`)

## Build a release

From the repo root:

```bash
scripts/apple/build-xcframeworks.sh --version 1.2.0
```

The script writes artifacts to `dist/apple-xcframeworks/1.2.0/` by default:

- `HudsonLive-1.2.0.xcframework.zip`
- `HudsonObservability-1.2.0.xcframework.zip`
- `HudsonUI-1.2.0.xcframework.zip`
- `HudsonShell-1.2.0.xcframework.zip`
- `checksums.txt`
- `Package.swift`

Upload the zip files to a public GitHub Release or CDN. The generated
`Package.swift` uses
`https://github.com/arach/hudsonkit-xcframework/releases/download/VERSION` unless you
pass a different `--base-url`.

```bash
scripts/apple/build-xcframeworks.sh \
  --version 1.2.0 \
  --base-url https://github.com/arach/hudsonkit-xcframework/releases/download/1.2.0
```

## What the script does

- Stages each module in an isolated Swift package and compiles it as a dynamic
  library. Previously built Hudson dependencies are consumed as binary targets,
  ensuring that `HudsonUI` and `HudsonObservability` are linked rather than
  copied into `HudsonShell`.
- Archives with `BUILD_LIBRARY_FOR_DISTRIBUTION=YES` so each framework contains
  stable `.swiftinterface` files.
- Verifies every declared `@rpath` dependency and fails if a framework defines
  Swift symbols owned by one of its dependency modules. This prevents duplicate
  Objective-C runtime classes when an app loads the complete framework set.
- Builds macOS `arm64` and `x86_64` slices by default.
- Creates `.xcframework` bundles, zips them with the expected root layout, and
  computes `swift package compute-checksum` values.
- Uses per-run DerivedData under `~/Library/Caches/codex-builds/` and deletes it
  unless `--keep-intermediates` is passed.

## Consumer package

A public consumer package should reference only the hosted zips and checksums:

```swift
// Package.swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Pomo",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(
            url: "https://github.com/arach/hudsonkit-xcframework.git",
            exact: "1.2.0"
        ),
    ],
    targets: [
        .executableTarget(
            name: "Pomo",
            dependencies: [
                .product(name: "HudsonUI", package: "hudsonkit-xcframework"),
                .product(name: "HudsonShell", package: "hudsonkit-xcframework"),
            ]
        ),
    ]
)
```

Today `HudsonUI`'s public interface references `HudsonLive` and
`HudsonObservability`, and `HudsonShell` references `HudsonUI` and
`HudsonObservability`. The generated binary package includes those support
modules as binary targets so downstream repos still contain zero Hudson source.
