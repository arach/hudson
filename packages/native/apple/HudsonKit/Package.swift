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
let environment = ProcessInfo.processInfo.environment
let terminalEnabled = environment["HUDSONKIT_WITH_TERMINAL"] == "1"
let voiceEnabled    = environment["HUDSONKIT_WITH_VOICE"] == "1"

func nonEmptyEnv(_ key: String) -> String? {
    guard let value = environment[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty
    else {
        return nil
    }
    return value
}

func firstNonEmptyEnv(_ keys: [String]) -> String? {
    for key in keys {
        if let value = nonEmptyEnv(key) {
            return value
        }
    }
    return nil
}

func packageIdentity(forGitURL url: String) -> String {
    var candidate = url.split(separator: "/").last.map(String.init) ?? url
    if candidate.hasSuffix(".git") {
        candidate.removeLast(4)
    }
    return candidate.lowercased()
}

@discardableResult
func appendSourceDependency(
    to dependencies: inout [Package.Dependency],
    envPrefix: String,
    packageName defaultPackageName: String,
    defaultPath: String,
    gitURL defaultGitURL: String,
    branch defaultBranch: String = "main",
    pathEnvAliases: [String] = []
) -> String {
    let packageName = nonEmptyEnv("\(envPrefix)_PACKAGE") ?? defaultPackageName
    let path = firstNonEmptyEnv(["\(envPrefix)_PATH"] + pathEnvAliases)
    let defaultSource = path == nil ? "git" : "path"
    let source = (nonEmptyEnv("\(envPrefix)_SOURCE") ?? defaultSource).lowercased()

    switch source {
    case "path", "local":
        dependencies.append(
            .package(
                name: packageName,
                path: path ?? defaultPath
            )
        )
        return packageName

    case "git", "remote":
        let url = nonEmptyEnv("\(envPrefix)_GIT_URL") ?? defaultGitURL
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

    default:
        fatalError("Unsupported \(envPrefix)_SOURCE '\(source)'. Expected 'git' or 'path'.")
    }
}

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
    .library(name: "HudsonVantageCore", targets: ["HudsonVantageCore"]),
    .library(name: "HudsonVantageCompanion", targets: ["HudsonVantageCompanion"]),
]

var dependencies: [Package.Dependency] = []

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
        ]
    ),
    .target(name: "HudsonUIPermissions", dependencies: ["HudsonUI"]),
    .target(name: "HudsonUIAudio", dependencies: ["HudsonUI", "HudsonUIPermissions"]),
    .target(name: "HudsonUICapture", dependencies: ["HudsonUI"]),
    .target(name: "HudsonUIWeb"),
    .target(name: "HudsonUIKeyboard", dependencies: ["HudsonUI"]),
    .target(name: "HudsonUIOnboarding", dependencies: ["HudsonUI"]),
    .target(name: "HudsonWorkflow", dependencies: ["HudsonUI", "HudsonShell", "HudsonObservability"]),
    .target(name: "HudsonBridge"),
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
    .testTarget(name: "HudsonBridgeTests", dependencies: ["HudsonBridge"]),
    .testTarget(name: "HudsonDiffTests", dependencies: ["HudsonDiff"]),
    .testTarget(name: "HudsonLiveTests", dependencies: ["HudsonLive"]),
    .testTarget(name: "HudsonUIWebTests", dependencies: ["HudsonUIWeb"]),
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
        ]
    ),
]

if voiceEnabled {
    // Vox = embeddable Parakeet engine (on-device download + execution).
    dependencies.append(.package(name: "Vox", path: "../../../../../vox/swift"))
    products.append(.library(name: "HudsonVoice", targets: ["HudsonVoice"]))
    targets.append(
        .target(
            name: "HudsonVoice",
            dependencies: [
                "HudsonUI",
                "HudsonObservability",
                .product(name: "VoxEngine", package: "Vox"),
            ]
        )
    )
    demoDependencies.append("HudsonVoice")
    demoSwiftSettings.append(.define("HUDSON_VOICE"))
}

if terminalEnabled {
    products.append(.library(name: "HudsonTerminal", targets: ["HudsonTerminal"]))
    let terminiPackage = appendSourceDependency(
        to: &dependencies,
        envPrefix: "HUDSON_TERMINI",
        packageName: "Termini",
        defaultPath: "../../../../../Termini",
        gitURL: "git@github.com:arach/Termini.git",
        pathEnvAliases: ["HUDSONKIT_TERMINI_PATH"]
    )
    products.append(.library(name: "HudsonVantageSurface", targets: ["HudsonVantageSurface"]))
    products.append(.library(name: "HudsonVantage", targets: ["HudsonVantage"]))
    targets.append(
        .target(
            name: "HudsonTerminal",
            dependencies: [
                "HudsonUI",
                .product(name: "Termini", package: terminiPackage),
                .product(name: "TerminiSSH", package: terminiPackage),
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
                .product(name: "Termini", package: terminiPackage),
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
