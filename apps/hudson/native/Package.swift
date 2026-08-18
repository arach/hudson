// swift-tools-version: 5.9
import PackageDescription
import Foundation

let voiceHelperEnabled = ProcessInfo.processInfo.environment["HUDSON_WITH_VOICE_HELPER"] == "1"

var dependencies: [Package.Dependency] = [
    .package(path: "../../.."),
]

var targets: [Target] = [
    .executableTarget(
        name: "HudsonApp",
        dependencies: [
            .product(name: "HudsonCanvas", package: "Hudson"),
        ],
        path: "Sources/HudsonApp"
    ),
]

if voiceHelperEnabled {
    dependencies.append(
        .package(name: "Vox", path: "../../../../vox")
    )
    targets.append(
        .target(
            name: "HudsonNativeSupport",
            dependencies: [
                .product(name: "VoxService", package: "Vox"),
            ],
            path: "Sources/HudsonNativeSupport"
        )
    )
    targets.append(
        .executableTarget(
            name: "HudsonMenuApp",
            dependencies: [
                "HudsonNativeSupport",
            ],
            path: "Sources/HudsonMenuApp"
        )
    )
}

let package = Package(
    name: "HudsonApp",
    platforms: [
        .macOS("26.0"),
    ],
    dependencies: dependencies,
    targets: targets
)
