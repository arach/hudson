// swift-tools-version: 5.9
import PackageDescription
import Foundation

let terminalEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_TERMINAL"] == "1"

var targets: [Target] = [
    .executableTarget(
        name: "VantageCompanionPreview",
        dependencies: [
            .product(name: "HudsonVantageCompanion", package: "Hudson"),
            .product(name: "HudsonVantageCore", package: "Hudson"),
        ],
        path: "Sources/VantageCompanionPreview"
    ),
]

if terminalEnabled {
    targets.append(
        .executableTarget(
            name: "VantageCanvas",
            dependencies: [
                .product(name: "HudsonVantage", package: "Hudson"),
            ],
            path: "Sources/VantageCanvas"
        )
    )
}

let package = Package(
    name: "VantageCanvas",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: [
        .package(name: "Hudson", path: "../.."),
    ],
    targets: targets
)
