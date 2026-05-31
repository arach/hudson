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
    .library(name: "HudsonLive", targets: ["HudsonLive"]),
    .library(name: "HudsonDiff", targets: ["HudsonDiff"]),
    .library(name: "HudsonUI", targets: ["HudsonUI"]),
    .library(name: "HudsonWorkflow", targets: ["HudsonWorkflow"]),
    .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
    .library(name: "HudsonShell", targets: ["HudsonShell"]),
    .library(name: "HudsonAI", targets: ["HudsonAI"]),
    .library(name: "HudsonVantageCore", targets: ["HudsonVantageCore"]),
    .library(name: "HudsonVantageCompanion", targets: ["HudsonVantageCompanion"]),
]

var dependencies: [Package.Dependency] = [
    .package(url: "https://github.com/ChimeHQ/SwiftTreeSitter", from: "0.10.0"),
    .package(url: "https://github.com/alex-pinkus/tree-sitter-swift", branch: "with-generated-files"),
]

var demoDependencies: [Target.Dependency] = ["HudsonUI", "HudsonShell"]
var demoSwiftSettings: [SwiftSetting] = []

var targets: [Target] = [
    .target(name: "HudsonObservability"),
    .target(name: "HudsonLive"),
    .target(name: "HudsonDiff"),
    .target(
        name: "HudsonUI",
        dependencies: [
            "HudsonLive",
            "HudsonObservability",
            .product(name: "SwiftTreeSitter", package: "SwiftTreeSitter"),
            .product(name: "TreeSitterSwift", package: "tree-sitter-swift"),
        ]
    ),
    .target(name: "HudsonWorkflow", dependencies: ["HudsonUI", "HudsonShell", "HudsonObservability"]),
    .target(name: "HudsonBridge", dependencies: ["HudsonUI"]),
    .target(name: "HudsonShell", dependencies: ["HudsonUI", "HudsonObservability"]),
    .target(name: "HudsonAI", dependencies: ["HudsonUI"]),
    .target(
        name: "HudsonVantageCore",
        dependencies: [
            "HudsonUI",
        ]
    ),
    .target(
        name: "HudsonVantageCompanion",
        dependencies: [
            "HudsonUI",
            "HudsonVantageCore",
        ]
    ),
    .testTarget(name: "HudsonAITests", dependencies: ["HudsonAI"]),
    .testTarget(name: "HudsonDiffTests", dependencies: ["HudsonDiff"]),
    .testTarget(name: "HudsonLiveTests", dependencies: ["HudsonLive"]),
    .testTarget(name: "HudsonUITests", dependencies: ["HudsonUI", "HudsonLive"]),
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
    dependencies.append(.package(path: "/Users/arach/dev/termini"))
    products.append(.library(name: "HudsonVantageSurface", targets: ["HudsonVantageSurface"]))
    products.append(.library(name: "HudsonVantage", targets: ["HudsonVantage"]))
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
    targets.append(
        .target(
            name: "HudsonVantageSurface",
            dependencies: [
                "HudsonDiff",
                "HudsonLive",
                "HudsonObservability",
                "HudsonUI",
                "HudsonShell",
                "HudsonTerminal",
                "HudsonVantageCore",
                .product(name: "Termini", package: "Termini"),
            ],
            resources: [
                .process("Resources")
            ]
        )
    )
    targets.append(
        .target(
            name: "HudsonVantage",
            dependencies: [
                "HudsonUI",
                "HudsonVantageCompanion",
                "HudsonVantageCore",
                "HudsonVantageSurface",
            ]
        )
    )
    targets.append(
        .testTarget(name: "HudsonVantageTests", dependencies: ["HudsonVantage"])
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
