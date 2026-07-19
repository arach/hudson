#!/usr/bin/env swift
import AppKit
import Foundation

struct IconSpec {
    let filename: String
    let size: CGFloat
}

let specs: [IconSpec] = [
    IconSpec(filename: "icon_16x16.png", size: 16),
    IconSpec(filename: "icon_16x16@2x.png", size: 32),
    IconSpec(filename: "icon_32x32.png", size: 32),
    IconSpec(filename: "icon_32x32@2x.png", size: 64),
    IconSpec(filename: "icon_128x128.png", size: 128),
    IconSpec(filename: "icon_128x128@2x.png", size: 256),
    IconSpec(filename: "icon_256x256.png", size: 256),
    IconSpec(filename: "icon_256x256@2x.png", size: 512),
    IconSpec(filename: "icon_512x512.png", size: 512),
    IconSpec(filename: "icon_512x512@2x.png", size: 1024),
]

func drawIcon(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()

    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    NSColor.clear.setFill()
    rect.fill()

    let background = NSColor(
        calibratedRed: 17.0 / 255,
        green: 19.0 / 255,
        blue: 21.0 / 255,
        alpha: 1
    )
    background.setFill()
    NSBezierPath(
        roundedRect: rect,
        xRadius: size * 0.21875,
        yRadius: size * 0.21875
    ).fill()

    let panels: [[CGPoint]] = [
        [
            CGPoint(x: 0, y: 0), CGPoint(x: 30, y: 0),
            CGPoint(x: 30, y: 30), CGPoint(x: 24, y: 30),
            CGPoint(x: 24, y: 22), CGPoint(x: 18, y: 22),
            CGPoint(x: 18, y: 30), CGPoint(x: 0, y: 30),
        ],
        [
            CGPoint(x: 34, y: 0), CGPoint(x: 64, y: 0),
            CGPoint(x: 64, y: 30), CGPoint(x: 46, y: 30),
            CGPoint(x: 46, y: 22), CGPoint(x: 40, y: 22),
            CGPoint(x: 40, y: 30), CGPoint(x: 34, y: 30),
        ],
        [
            CGPoint(x: 0, y: 34), CGPoint(x: 18, y: 34),
            CGPoint(x: 18, y: 42), CGPoint(x: 24, y: 42),
            CGPoint(x: 24, y: 34), CGPoint(x: 30, y: 34),
            CGPoint(x: 30, y: 64), CGPoint(x: 0, y: 64),
        ],
        [
            CGPoint(x: 34, y: 34), CGPoint(x: 40, y: 34),
            CGPoint(x: 40, y: 42), CGPoint(x: 46, y: 42),
            CGPoint(x: 46, y: 34), CGPoint(x: 64, y: 34),
            CGPoint(x: 64, y: 64), CGPoint(x: 34, y: 64),
        ],
    ]

    let markOrigin = size * 0.2265625
    let markScale = (size * 0.546875) / 64
    NSColor(
        calibratedRed: 247.0 / 255,
        green: 247.0 / 255,
        blue: 245.0 / 255,
        alpha: 1
    ).setFill()

    for panel in panels {
        guard let first = panel.first else { continue }
        let path = NSBezierPath()
        path.move(to: NSPoint(
            x: markOrigin + first.x * markScale,
            y: markOrigin + first.y * markScale
        ))
        for point in panel.dropFirst() {
            path.line(to: NSPoint(
                x: markOrigin + point.x * markScale,
                y: markOrigin + point.y * markScale
            ))
        }
        path.close()
        path.fill()
    }

    image.unlockFocus()
    return image
}

func writePNG(_ image: NSImage, to url: URL) throws {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "CanvasIcon", code: 1)
    }
    try data.write(to: url)
}

let scriptURL = URL(fileURLWithPath: CommandLine.arguments[0])
let scriptsDir = scriptURL.deletingLastPathComponent()
let packageRoot = scriptsDir.deletingLastPathComponent()
let iconsetDir = packageRoot.appendingPathComponent("Resources/AppIcon.iconset", isDirectory: true)
let icnsPath = packageRoot.appendingPathComponent("Resources/AppIcon.icns")

try FileManager.default.createDirectory(at: iconsetDir, withIntermediateDirectories: true)

for spec in specs {
    let image = drawIcon(size: spec.size)
    try writePNG(image, to: iconsetDir.appendingPathComponent(spec.filename))
}

let task = Process()
task.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
task.arguments = ["-c", "icns", iconsetDir.path, "-o", icnsPath.path]
try task.run()
task.waitUntilExit()

guard task.terminationStatus == 0 else {
    fputs("iconutil failed\n", stderr)
    exit(1)
}

print("Wrote \(icnsPath.path)")
