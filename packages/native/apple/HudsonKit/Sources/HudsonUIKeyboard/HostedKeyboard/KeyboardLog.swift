//
//  KeyboardLog.swift
//  HudsonUIKeyboard
//
//  Minimal self-contained logger for the hosted keyboard.
//  Wraps os.Logger; no external observability dependency.
//
//  Usage:
//  ```swift
//  private let log = Log(.ui)
//  log.info("Started")
//  log.error("Failed", error: error)
//  ```
//

import Foundation
import os

/// Log category for routing/filtering hosted-keyboard messages.
enum LogCategory: String, Sendable {
    case ui = "ui"
    case keyboard = "keyboard"
}

/// Lightweight per-file logger with a fixed category.
///
/// Routes to `os.Logger` under the `dev.hudson.keyboard` subsystem.
struct Log: Sendable {
    private let category: LogCategory
    private let logger: Logger

    init(_ category: LogCategory) {
        self.category = category
        self.logger = Logger(subsystem: "dev.hudson.keyboard", category: category.rawValue)
    }

    func debug(_ message: String, detail: String? = nil, file: String = #file, line: Int = #line) {
        logger.debug("\(Self.compose(message, detail: detail, error: nil), privacy: .public)")
    }

    func info(_ message: String, detail: String? = nil, file: String = #file, line: Int = #line) {
        logger.info("\(Self.compose(message, detail: detail, error: nil), privacy: .public)")
    }

    func warning(_ message: String, detail: String? = nil, error: Error? = nil, file: String = #file, line: Int = #line) {
        logger.log(level: .default, "\(Self.compose(message, detail: detail, error: error), privacy: .public)")
    }

    func error(_ message: String, detail: String? = nil, error: Error? = nil, file: String = #file, line: Int = #line) {
        logger.error("\(Self.compose(message, detail: detail, error: error), privacy: .public)")
    }

    func error(_ error: Error, file: String = #file, line: Int = #line) {
        logger.error("\(error.localizedDescription, privacy: .public)")
    }

    func fault(_ message: String, detail: String? = nil, error: Error? = nil, file: String = #file, line: Int = #line) {
        logger.fault("\(Self.compose(message, detail: detail, error: error), privacy: .public)")
    }

    private static func compose(_ message: String, detail: String?, error: Error?) -> String {
        var full = detail ?? ""
        if let error {
            full = full.isEmpty ? error.localizedDescription : "\(full) | \(error.localizedDescription)"
        }
        return full.isEmpty ? message : "\(message) - \(full)"
    }
}
