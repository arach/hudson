// swift-tools-version: 5.9
import PackageDescription
import Foundation

let terminalEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_TERMINAL"] == "1"
let voiceEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_VOICE"] == "1"

// SwiftPM resolves every declared package dependency up front. Keep the heavy
// terminal backend out of default HudsonKit consumers, and opt into it only for
// hosts that explicitly build with HUDSONKIT_WITH_TERMINAL=1.
var products: [Product] = [
    .library(name: "HudsonObservability", targets: ["HudsonObservability"]),
    .library(name: "HudsonLive", targets: ["HudsonLive"]),
    .library(name: "HudsonDiff", targets: ["HudsonDiff"]),
    .library(name: "HudsonUI", targets: ["HudsonUI"]),
    .library(name: "HudsonUICapture", targets: ["HudsonUICapture"]),
    .library(name: "HudsonWorkflow", targets: ["HudsonWorkflow"]),
    .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
    .library(name: "HudsonShell", targets: ["HudsonShell"]),
    .library(name: "HudsonVantageCore", targets: ["HudsonVantageCore"]),
    .library(name: "HudsonVantageCompanion", targets: ["HudsonVantageCompanion"]),
]

var dependencies: [Package.Dependency] = []

var targets: [Target] = [
    .target(
        name: "HudsonObservability",
        path: "packages/native/apple/HudsonKit/Sources/HudsonObservability"
    ),
    .target(
        name: "HudsonLive",
        path: "packages/native/apple/HudsonKit/Sources/HudsonLive"
    ),
    .target(
        name: "HudsonDiff",
        path: "packages/native/apple/HudsonKit/Sources/HudsonDiff"
    ),
    .target(
        name: "HudsonUI",
        dependencies: [
            "HudsonLive",
            "HudsonObservability",
        ],
        path: "packages/native/apple/HudsonKit/Sources/HudsonUI"
    ),
    .target(
        name: "HudsonUICapture",
        dependencies: ["HudsonUI"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonUICapture"
    ),
    .target(
        name: "HudsonWorkflow",
        dependencies: ["HudsonUI", "HudsonShell", "HudsonObservability"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonWorkflow"
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
        name: "HudsonVantageCore",
        dependencies: ["HudsonUI"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonVantageCore"
    ),
    .target(
        name: "HudsonVantageCompanion",
        dependencies: ["HudsonUI", "HudsonVantageCore"],
        path: "packages/native/apple/HudsonKit/Sources/HudsonVantageCompanion"
    ),
]

if voiceEnabled {
    // Vox = embeddable Parakeet engine (on-device download + execution).
    dependencies.append(.package(name: "Vox", path: "../vox/swift"))
    products.append(.library(name: "HudsonVoice", targets: ["HudsonVoice"]))
    targets.append(
        .target(
            name: "HudsonVoice",
            dependencies: [
                "HudsonUI",
                "HudsonObservability",
                .product(name: "VoxEngine", package: "Vox"),
            ],
            path: "packages/native/apple/HudsonKit/Sources/HudsonVoice"
        )
    )
}

if terminalEnabled {
    products.append(.library(name: "HudsonTerminal", targets: ["HudsonTerminal"]))
    products.append(.library(name: "HudsonVantageSurface", targets: ["HudsonVantageSurface"]))
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
            path: "packages/native/apple/HudsonKit/Sources/HudsonVantageSurface",
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
