// swift-tools-version: 5.9
import PackageDescription
import Foundation

// Single Hudson package manifest.
//
// This is the one source of truth for the Apple package. It replaces the former
// split between this root manifest and the inner
// `packages/native/apple/HudsonKit/Package.swift` dev/CI manifest.
//
// Optional heavy backends stay gated by env at manifest-eval time so light
// consumers do not resolve dependencies they do not use:
//   HUDSONKIT_WITH_TERMINAL=1  -> HudsonTerminal + Canvas surface
//   HUDSONKIT_WITH_VOICE=0     -> opt out of HudsonVoice
let environment = ProcessInfo.processInfo.environment
let terminalEnabled = environment["HUDSONKIT_WITH_TERMINAL"] == "1"
let voiceEnabled = environment["HUDSONKIT_WITH_VOICE"] != "0"

func nonEmptyEnv(_ key: String) -> String? {
    guard let value = environment[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty
    else {
        return nil
    }
    return value
}

func packageIdentity(forGitURL url: String) -> String {
    var candidate = url.split(separator: "/").last.map(String.init) ?? url
    if candidate.hasSuffix(".git") {
        candidate.removeLast(4)
    }
    return candidate.lowercased()
}

@discardableResult
func appendGitDependency(
    to dependencies: inout [Package.Dependency],
    url defaultURL: String,
    branch defaultBranch: String = "main",
    envPrefix: String
) -> String {
    let url = nonEmptyEnv("\(envPrefix)_GIT_URL") ?? defaultURL

    if let revision = nonEmptyEnv("\(envPrefix)_GIT_REVISION") {
        dependencies.append(.package(url: url, revision: revision))
    } else {
        dependencies.append(
            .package(
                url: url,
                branch: nonEmptyEnv("\(envPrefix)_GIT_BRANCH") ?? defaultBranch
            )
        )
    }

    return nonEmptyEnv("\(envPrefix)_PACKAGE") ?? packageIdentity(forGitURL: url)
}

let src = "packages/native/apple/HudsonKit/Sources/"
let tst = "packages/native/apple/HudsonKit/Tests/"
let demo = "packages/native/apple/HudsonKit/Demo/"

var products: [Product] = [
    .library(name: "HudsonObservability", targets: ["HudsonObservability"]),
    .library(name: "HudsonLive", targets: ["HudsonLive"]),
    .library(name: "HudsonDiff", targets: ["HudsonDiff"]),
    .library(name: "HudsonUI", targets: ["HudsonUI"]),
    .library(name: "HudsonUIPermissions", targets: ["HudsonUIPermissions"]),
    .library(name: "HudsonUIAudio", targets: ["HudsonUIAudio"]),
    .library(name: "HudsonUICapture", targets: ["HudsonUICapture"]),
    .library(name: "HudsonUIWeb", targets: ["HudsonUIWeb"]),
    .library(name: "HudsonUIKeyboard", targets: ["HudsonUIKeyboard"]),
    .library(name: "HudsonUIOnboarding", targets: ["HudsonUIOnboarding"]),
    .library(name: "HudsonWorkflow", targets: ["HudsonWorkflow"]),
    .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
    .library(name: "HudsonShell", targets: ["HudsonShell"]),
    .library(name: "HudsonAI", targets: ["HudsonAI"]),
    .library(name: "HudsonCanvasCore", targets: ["HudsonCanvasCore"]),
    .library(name: "HudsonCanvasCompanion", targets: ["HudsonCanvasCompanion"]),
]

var dependencies: [Package.Dependency] = []

var demoDependencies: [Target.Dependency] = ["HudsonUI", "HudsonUIWeb", "HudsonShell"]
var demoSwiftSettings: [SwiftSetting] = []

var targets: [Target] = [
    .target(name: "HudsonObservability", path: src + "HudsonObservability"),
    .target(name: "HudsonLive", path: src + "HudsonLive"),
    .target(name: "HudsonDiff", path: src + "HudsonDiff"),
    .target(name: "HudsonUI", dependencies: ["HudsonLive", "HudsonObservability"], path: src + "HudsonUI"),
    .target(name: "HudsonUIPermissions", dependencies: ["HudsonUI"], path: src + "HudsonUIPermissions"),
    .target(name: "HudsonUIAudio", dependencies: ["HudsonUI", "HudsonUIPermissions"], path: src + "HudsonUIAudio"),
    .target(name: "HudsonUICapture", dependencies: ["HudsonUI"], path: src + "HudsonUICapture"),
    .target(
        name: "HudsonUIWeb",
        dependencies: ["HudsonUI"],
        path: src + "HudsonUIWeb",
        resources: [
            .process("Resources"),
        ]
    ),
    .target(name: "HudsonUIKeyboard", dependencies: ["HudsonUI"], path: src + "HudsonUIKeyboard"),
    .target(name: "HudsonUIOnboarding", dependencies: ["HudsonUI"], path: src + "HudsonUIOnboarding"),
    .target(name: "HudsonWorkflow", dependencies: ["HudsonUI", "HudsonShell", "HudsonObservability"], path: src + "HudsonWorkflow"),
    .target(name: "HudsonBridge", dependencies: ["HudsonUI"], path: src + "HudsonBridge"),
    .target(name: "HudsonShell", dependencies: ["HudsonUI", "HudsonObservability"], path: src + "HudsonShell"),
    .target(name: "HudsonAI", dependencies: ["HudsonUI"], path: src + "HudsonAI"),
    .target(name: "HudsonCanvasCore", dependencies: ["HudsonUI"], path: src + "HudsonCanvasCore"),
    .target(name: "HudsonCanvasCompanion", dependencies: ["HudsonUI", "HudsonCanvasCore"], path: src + "HudsonCanvasCompanion"),

    .testTarget(name: "HudsonAITests", dependencies: ["HudsonAI"], path: tst + "HudsonAITests"),
    .testTarget(name: "HudsonBridgeTests", dependencies: ["HudsonBridge"], path: tst + "HudsonBridgeTests"),
    .testTarget(name: "HudsonDiffTests", dependencies: ["HudsonDiff"], path: tst + "HudsonDiffTests"),
    .testTarget(name: "HudsonLiveTests", dependencies: ["HudsonLive"], path: tst + "HudsonLiveTests"),
    .testTarget(name: "HudsonUIWebTests", dependencies: ["HudsonUIWeb"], path: tst + "HudsonUIWebTests"),
    .testTarget(name: "HudsonShellTests", dependencies: ["HudsonShell"], path: tst + "HudsonShellTests"),
    .testTarget(
        name: "HudsonUITests",
        dependencies: [
            "HudsonUI",
            "HudsonUIPermissions",
            "HudsonUIAudio",
            "HudsonUICapture",
            "HudsonUIKeyboard",
            "HudsonUIOnboarding",
            "HudsonLive",
        ],
        path: tst + "HudsonUITests"
    ),
]

if voiceEnabled {
    let voxPackage = appendGitDependency(
        to: &dependencies,
        url: "git@github.com:arach/vox.git",
        envPrefix: "HUDSON_VOX"
    )
    products.append(.library(name: "HudsonVoice", targets: ["HudsonVoice"]))
    targets.append(
        .target(
            name: "HudsonVoice",
            dependencies: [
                "HudsonUI",
                "HudsonObservability",
                .product(name: "VoxEngine", package: voxPackage),
            ],
            path: src + "HudsonVoice"
        )
    )
    demoDependencies.append("HudsonVoice")
    demoSwiftSettings.append(.define("HUDSON_VOICE"))
}

if terminalEnabled {
    products.append(.library(name: "HudsonTerminal", targets: ["HudsonTerminal"]))
    products.append(.library(name: "HudsonCanvasSurface", targets: ["HudsonCanvasSurface"]))
    products.append(.library(name: "HudsonCanvas", targets: ["HudsonCanvas"]))
    let terminiPackage = appendGitDependency(
        to: &dependencies,
        url: "git@github.com:arach/Termini.git",
        envPrefix: "HUDSON_TERMINI"
    )
    targets.append(
        .target(
            name: "HudsonTerminal",
            dependencies: [
                "HudsonUI",
                .product(name: "Termini", package: terminiPackage),
                .product(name: "TerminiSSH", package: terminiPackage),
            ],
            path: src + "HudsonTerminal"
        )
    )
    targets.append(
        .target(
            name: "HudsonCanvasSurface",
            dependencies: [
                "HudsonDiff",
                "HudsonLive",
                "HudsonObservability",
                "HudsonUI",
                "HudsonUIWeb",
                "HudsonShell",
                "HudsonTerminal",
                "HudsonCanvasCore",
                .product(name: "Termini", package: terminiPackage),
            ],
            path: src + "HudsonCanvasSurface"
        )
    )
    targets.append(
        .target(
            name: "HudsonCanvas",
            dependencies: [
                "HudsonUI",
                "HudsonCanvasCompanion",
                "HudsonCanvasCore",
                "HudsonCanvasSurface",
            ],
            path: src + "HudsonCanvas"
        )
    )
    targets.append(
        .testTarget(
            name: "HudsonCanvasTests",
            dependencies: ["HudsonCanvas", "HudsonCanvasSurface"],
            path: tst + "HudsonCanvasTests"
        )
    )
    demoDependencies.append("HudsonTerminal")
    demoDependencies.append("HudsonCanvas")
    demoSwiftSettings.append(.define("HUDSON_TERMINAL"))
}

targets.append(
    .executableTarget(
        name: "HudsonKitDemo",
        dependencies: demoDependencies,
        path: demo + "HudsonKitDemo",
        resources: [
            .copy("Fixtures"),
        ],
        swiftSettings: demoSwiftSettings
    )
)

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
