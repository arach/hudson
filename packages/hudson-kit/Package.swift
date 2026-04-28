// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "hudson-kit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "HudsonUI", targets: ["HudsonUI"]),
        .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
        .library(name: "HudsonShell", targets: ["HudsonShell"]),
        .library(name: "HudsonTerminal", targets: ["HudsonTerminal"]),
    ],
    dependencies: [
        .package(url: "https://github.com/arach/TermBridgeKit.git", exact: "0.1.3"),
    ],
    targets: [
        .target(name: "HudsonUI"),
        .target(name: "HudsonBridge", dependencies: ["HudsonUI"]),
        .target(name: "HudsonShell", dependencies: ["HudsonUI"]),
        .target(
            name: "HudsonTerminal",
            dependencies: [
                "HudsonUI",
                .product(name: "TermBridgeKit", package: "TermBridgeKit"),
            ]
        ),

        // Demo executable — runs on macOS via `swift run HudsonKitDemo`.
        // Exercises every HudsonUI primitive in two manifest variants. iOS
        // simulator support comes when an Xcode project is added in M2/M3.
        .executableTarget(
            name: "HudsonKitDemo",
            dependencies: ["HudsonUI", "HudsonShell"],
            path: "Demo/HudsonKitDemo"
        ),
    ]
)
