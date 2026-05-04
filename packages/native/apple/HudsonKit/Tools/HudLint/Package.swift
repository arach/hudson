// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HudLint",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .library(name: "HudLintCore", targets: ["HudLintCore"]),
        .executable(name: "hudlint", targets: ["hudlint"]),
    ],
    targets: [
        .target(name: "HudLintCore"),
        .executableTarget(
            name: "hudlint",
            dependencies: ["HudLintCore"]
        ),
        .testTarget(
            name: "HudLintCoreTests",
            dependencies: ["HudLintCore"]
        ),
    ]
)
