// swift-tools-version: 5.9
import PackageDescription
import Foundation

// Optional features gated by build-time env vars. SwiftPM resolves every
// declared dependency up front, and not every consumer wants every backend —
// so heavier or platform-coupled targets stay opt-in.
//
//   HUDSONKIT_WITH_TERMINAL=1   → HudsonTerminal + Termini package
//   HUDSONKIT_WITH_VOICE=1      → HudsonVoice
//
// Enable both at once: HUDSONKIT_WITH_TERMINAL=1 HUDSONKIT_WITH_VOICE=1 swift build
let terminalEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_TERMINAL"] == "1"
let voiceEnabled    = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_VOICE"] == "1"

var products: [Product] = [
    .library(name: "HudsonObservability", targets: ["HudsonObservability"]),
    .library(name: "HudsonUI", targets: ["HudsonUI"]),
    .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
    .library(name: "HudsonShell", targets: ["HudsonShell"]),
    .library(name: "HudsonAI", targets: ["HudsonAI"]),
]

var dependencies: [Package.Dependency] = []

var demoDependencies: [Target.Dependency] = ["HudsonUI", "HudsonShell"]
var demoSwiftSettings: [SwiftSetting] = []

var targets: [Target] = [
    .target(name: "HudsonObservability"),
    .target(name: "HudsonUI", dependencies: ["HudsonObservability"]),
    .target(name: "HudsonBridge", dependencies: ["HudsonUI"]),
    .target(name: "HudsonShell", dependencies: ["HudsonUI", "HudsonObservability"]),
    .target(name: "HudsonAI", dependencies: ["HudsonUI"]),
    .testTarget(name: "HudsonAITests", dependencies: ["HudsonAI"]),
    .testTarget(name: "HudsonUITests", dependencies: ["HudsonUI"]),
]

if voiceEnabled {
    products.append(.library(name: "HudsonVoice", targets: ["HudsonVoice"]))
    targets.append(
        .target(name: "HudsonVoice", dependencies: ["HudsonUI", "HudsonObservability"])
    )
    demoDependencies.append("HudsonVoice")
    demoSwiftSettings.append(.define("HUDSON_VOICE"))
}

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
