// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HudsonApp",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: [
        .package(path: "../../.."),
        .package(name: "Vox", path: "../../../../vox/swift"),
    ],
    targets: [
        .target(
            name: "HudsonNativeSupport",
            dependencies: [
                .product(name: "VoxService", package: "Vox"),
            ],
            path: "Sources/HudsonNativeSupport"
        ),
        .executableTarget(
            name: "HudsonApp",
            dependencies: [
                .product(name: "HudsonVantage", package: "Hudson"),
            ],
            path: "Sources/HudsonApp"
        ),
        .executableTarget(
            name: "HudsonMenuApp",
            dependencies: [
                "HudsonNativeSupport",
            ],
            path: "Sources/HudsonMenuApp"
        ),
    ]
)
