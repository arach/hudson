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
    .library(name: "HudsonAI", targets: ["HudsonAI"]),
]

var dependencies: [Package.Dependency] = []

var demoDependencies: [Target.Dependency] = ["HudsonUI", "HudsonShell", "HudsonVoice"]
var demoSwiftSettings: [SwiftSetting] = []

var targets: [Target] = [
    .target(name: "HudsonObservability"),
    .target(name: "HudsonUI", dependencies: ["HudsonObservability"]),
    .target(name: "HudsonBridge", dependencies: ["HudsonUI"]),
    .target(name: "HudsonShell", dependencies: ["HudsonUI", "HudsonObservability"]),
    .target(name: "HudsonVoice", dependencies: ["HudsonUI", "HudsonObservability"]),
    .target(name: "HudsonAI", dependencies: ["HudsonUI"]),
    .testTarget(name: "HudsonAITests", dependencies: ["HudsonAI"]),
]

if terminalEnabled {
    products.append(.library(name: "HudsonTerminal", targets: ["HudsonTerminal"]))
    dependencies.append(.package(path: "/Users/arach/dev/Termini"))
    targets.append(
        .target(
            name: "HudsonTerminal",
            dependencies: [
                "HudsonUI",
                .product(name: "Termini", package: "Termini"),
                .product(name: "TerminiSSH", package: "Termini"),
            ]
        )
    )
    demoDependencies.append("HudsonTerminal")
    demoSwiftSettings.append(.define("HUDSON_TERMINAL"))
}

targets.append(
    .executableTarget(
        name: "HudsonKitDemo",
        dependencies: demoDependencies,
        path: "Demo/HudsonKitDemo",
        swiftSettings: demoSwiftSettings
    )
)

let package = Package(
    name: "HudsonKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: products,
    dependencies: dependencies,
    targets: targets
)
