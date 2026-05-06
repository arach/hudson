// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TerminiCanvas",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: [
        .package(path: "../.."),
        .package(path: "../../../Termini"),
    ],
    targets: [
        .executableTarget(
            name: "TerminiCanvas",
            dependencies: [
                .product(name: "HudsonUI", package: "Hudson"),
                .product(name: "HudsonShell", package: "Hudson"),
                .product(name: "HudsonTerminal", package: "Hudson"),
                .product(name: "Termini", package: "Termini"),
            ],
            path: "Sources/TerminiCanvas"
        ),
    ]
)
