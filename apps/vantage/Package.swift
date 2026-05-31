// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VantageCanvas",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: [
        .package(name: "Hudson", path: "../.."),
    ],
    targets: [
        .executableTarget(
            name: "VantageCanvas",
            dependencies: [
                .product(name: "HudsonVantage", package: "Hudson"),
            ],
            path: "Sources/VantageCanvas"
        ),
    ]
)
