// swift-tools-version: 5.9
import PackageDescription
import Foundation

let terminalEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_TERMINAL"] == "1"

// SwiftPM resolves every declared package dependency up front. Keep the heavy
// terminal backend out of default HudsonKit consumers, and opt into it only for
// hosts that explicitly build with HUDSONKIT_WITH_TERMINAL=1.
var products: [Product] = [
    .library(name: "HudsonObservability", targets: ["HudsonObservability"]),
    .library(name: "HudsonUI", targets: ["HudsonUI"]),
    .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
    .library(name: "HudsonShell", targets: ["HudsonShell"]),
    .library(name: "HudsonVoice", targets: ["HudsonVoice"]),
]

var dependencies: [Package.Dependency] = []

var targets: [Target] = [
    .target(
        name: "HudsonObservability",
        path: "packages/native/apple/HudsonKit/Sources/HudsonObservability"
    ),
    .target(
        name: "HudsonUI",
        dependencies: ["HudsonObservability"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonUI"
    ),
    .target(
        name: "HudsonBridge",
        dependencies: ["HudsonUI"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonBridge"
    ),
    .target(
        name: "HudsonShell",
        dependencies: ["HudsonUI", "HudsonObservability"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonShell"
    ),
    .target(
        name: "HudsonVoice",
        dependencies: ["HudsonUI", "HudsonObservability"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonVoice"
    ),
]

if terminalEnabled {
    products.append(.library(name: "HudsonTerminal", targets: ["HudsonTerminal"]))
    products.append(.library(name: "HudsonVantage", targets: ["HudsonVantage"]))
    dependencies.append(.package(path: "../Termini"))
    targets.append(
        .target(
            name: "HudsonTerminal",
            dependencies: [
                "HudsonUI",
                .product(name: "Termini", package: "Termini"),
                .product(name: "TerminiSSH", package: "Termini"),
            ],
            path: "packages/native/apple/HudsonKit/Sources/HudsonTerminal"
        )
    )
    targets.append(
        .target(
            name: "HudsonVantage",
            dependencies: [
                "HudsonUI",
                "HudsonShell",
                "HudsonTerminal",
                .product(name: "Termini", package: "Termini"),
            ],
            path: "packages/native/apple/HudsonKit/Sources/HudsonVantage"
        )
    )
}

let package = Package(
    name: "Hudson",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: products,
    dependencies: dependencies,
    targets: targets
)
