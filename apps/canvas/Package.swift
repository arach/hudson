// swift-tools-version: 5.9
import PackageDescription
import Foundation

let terminalEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_TERMINAL"] == "1"

var targets: [Target] = [
    .executableTarget(
        name: "CanvasCompanionPreview",
        dependencies: [
            .product(name: "HudsonCanvasCompanion", package: "Hudson"),
            .product(name: "HudsonCanvasCore", package: "Hudson"),
        ],
        path: "Sources/CanvasCompanionPreview"
    ),
]

if terminalEnabled {
    targets.append(
        .executableTarget(
            name: "CanvasApp",
            dependencies: [
                .product(name: "HudsonCanvas", package: "Hudson"),
            ],
            path: "Sources/CanvasApp"
        )
    )
}

let package = Package(
    name: "CanvasApp",
    platforms: [
        .macOS("26.0"),
    ],
    dependencies: [
        .package(name: "Hudson", path: "../.."),
    ],
    targets: targets
)
