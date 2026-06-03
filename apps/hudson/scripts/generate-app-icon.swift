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
    let radius = size * 0.18

    let background = NSColor(calibratedRed: 0.05, green: 0.09, blue: 0.12, alpha: 1)
    background.setFill()
    NSBezierPath(roundedRect: rect.insetBy(dx: size * 0.04, dy: size * 0.04), xRadius: radius, yRadius: radius).fill()

    let gridInset = size * 0.18
    let cellGap = size * 0.05
    let cellWidth = (size - gridInset * 2 - cellGap) / 2
    let cellHeight = cellWidth
    let starts: [(CGFloat, CGFloat, CGFloat)] = [
        (0, 0, 0.95),
        (1, 0, 0.62),
        (0, 1, 0.62),
        (1, 1, 0.38),
    ]

    for (column, row, alpha) in starts {
        let x = gridInset + CGFloat(column) * (cellWidth + cellGap)
        let y = size - gridInset - cellHeight - CGFloat(row) * (cellHeight + cellGap)
        let cell = NSRect(x: x, y: y, width: cellWidth, height: cellHeight)
        let color = NSColor(calibratedRed: 0.18, green: 0.78, blue: 0.86, alpha: alpha)
        color.setFill()
        NSBezierPath(roundedRect: cell, xRadius: size * 0.05, yRadius: size * 0.05).fill()

        if alpha > 0.8 {
            let dot = NSRect(x: x + cellWidth * 0.18, y: y + cellHeight * 0.68, width: cellWidth * 0.12, height: cellHeight * 0.12)
            NSColor.white.withAlphaComponent(0.85).setFill()
            NSBezierPath(ovalIn: dot).fill()
        }
    }

    image.unlockFocus()
    return image
}

func writePNG(_ image: NSImage, to url: URL) throws {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "VantageIcon", code: 1)
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
