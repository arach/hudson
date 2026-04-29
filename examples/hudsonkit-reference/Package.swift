// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HudsonKitReference",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    dependencies: [
        // Branch dependency is used while HudsonKit is being reviewed on this PR.
        // After release, prefer: .package(url: "https://github.com/arach/hudson.git", from: "0.1.0")
        .package(url: "https://github.com/arach/hudson.git", branch: "sdk-voice-kit"),
    ],
    targets: [
        .executableTarget(
            name: "HudsonKitReference",
            dependencies: [
                .product(name: "HudsonUI", package: "hudson"),
                .product(name: "HudsonShell", package: "hudson"),
                .product(name: "HudsonVoice", package: "hudson"),
            ],
            path: "Sources"
        )
    ]
)
