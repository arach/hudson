// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TerminiCanvas",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: [
        .package(path: "../.."),
    ],
    targets: [
        .executableTarget(
            name: "TerminiCanvas",
            dependencies: [
                .product(name: "HudsonUI", package: "Hudson"),
                .product(name: "HudsonVantage", package: "Hudson"),
            ],
            path: "Sources/TerminiCanvas"
        ),
    ]
)
