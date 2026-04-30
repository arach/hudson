// swift-tools-version: 5.9
import PackageDescription
import Foundation

let terminalEnabled = ProcessInfo.processInfo.environment["HUDSONKIT_WITH_TERMINAL"] == "1"

// SwiftPM resolves every declared package dependency up front. Keep the heavy
// terminal backend out of default HudsonKit consumers, and opt into it only for
// hosts that explicitly build with HUDSONKIT_WITH_TERMINAL=1.
var products: [Product] = [
    .library(name: "HudsonUI", targets: ["HudsonUI"]),
    .library(name: "HudsonBridge", targets: ["HudsonBridge"]),
    .library(name: "HudsonShell", targets: ["HudsonShell"]),
    .library(name: "HudsonVoice", targets: ["HudsonVoice"]),
]

var dependencies: [Package.Dependency] = []

var demoDependencies: [Target.Dependency] = ["HudsonUI", "HudsonShell", "HudsonVoice"]
var demoSwiftSettings: [SwiftSetting] = []

var targets: [Target] = [
    .target(name: "HudsonUI"),
    .target(name: "HudsonBridge", dependencies: ["HudsonUI"]),
    .target(name: "HudsonShell", dependencies: ["HudsonUI"]),
    .target(name: "HudsonVoice", dependencies: ["HudsonUI"]),
]

if terminalEnabled {
    products.append(.library(name: "HudsonTerminal", targets: ["HudsonTerminal"]))
    dependencies.append(.package(url: "https://github.com/arach/TermBridgeKit.git", exact: "0.1.3"))
    targets.append(
        .target(
            name: "HudsonTerminal",
            dependencies: [
                "HudsonUI",
                .product(name: "TermBridgeKit", package: "TermBridgeKit"),
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
