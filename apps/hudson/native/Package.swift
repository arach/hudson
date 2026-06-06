// swift-tools-version: 5.9
import PackageDescription
import Foundation

// No voice helper target is declared here today. The embedded speech package
// exports only HudsonSpeechEngine; a future daemon/helper lane should come back
// through a separate HudsonVoiceService / HudsonSpeechService boundary.

var dependencies: [Package.Dependency] = [
    .package(path: "../../.."),
]

var targets: [Target] = [
    .executableTarget(
        name: "HudsonApp",
        dependencies: [
            .product(name: "HudsonVantage", package: "Hudson"),
        ],
        path: "Sources/HudsonApp"
    ),
]

let package = Package(
    name: "HudsonApp",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: dependencies,
    targets: targets
)
