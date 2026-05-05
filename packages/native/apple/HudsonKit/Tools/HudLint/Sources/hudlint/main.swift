import Foundation
import HudLintCore

struct CLIOptions {
    var roots: [String] = []
    var configPath: String?
    var format: ReporterFormat = .xcode
    var strict: Bool = true
    var quiet: Bool = false
}

func parseArgs(_ argv: [String]) -> CLIOptions {
    var opts = CLIOptions()
    var i = 1
    while i < argv.count {
        let arg = argv[i]
        switch arg {
        case "--root":
            i += 1
            if i < argv.count { opts.roots.append(argv[i]) }
        case "--config":
            i += 1
            if i < argv.count { opts.configPath = argv[i] }
        case "--format":
            i += 1
            if i < argv.count, let f = ReporterFormat(rawValue: argv[i]) { opts.format = f }
        case "--warn":
            opts.strict = false
        case "--quiet":
            opts.quiet = true
        case "--help", "-h":
            printUsage()
            exit(0)
        default:
            // Treat bare paths as roots for convenience.
            opts.roots.append(arg)
        }
        i += 1
    }
    return opts
}

func printUsage() {
    let usage = """
    hudlint — Hudson design-token enforcement

    Usage:
      hudlint --root <dir> [--root <dir> ...] [--config <path>] [--format xcode|plain|json] [--warn] [--quiet]

    Options:
      --root <dir>     Directory to scan recursively for .swift files (repeatable).
      --config <path>  Path to .hudlintignore (defaults to <first-root>/.hudlintignore).
      --format         Output format. Defaults to 'xcode' for Build Phase use.
      --warn           Emit warnings instead of errors (still exits non-zero with --strict default).
      --quiet          Suppress per-violation output; exit status communicates result.

    Exit status:
      0 — no violations found
      1 — violations found in strict mode
      2 — usage error
    """
    FileHandle.standardError.write(Data((usage + "\n").utf8))
}

let opts = parseArgs(CommandLine.arguments)

if opts.roots.isEmpty {
    printUsage()
    exit(2)
}

// Default config: <first-root>/.hudlintignore (or its parent for nested roots).
let configPath = opts.configPath ?? {
    let candidates = [
        "\(opts.roots[0])/.hudlintignore",
        "\(opts.roots[0])/../.hudlintignore",
    ]
    return candidates.first { FileManager.default.fileExists(atPath: $0) }
}()
let config = Configuration.load(from: configPath)
let scanner = LintScanner(rules: DefaultRules.all, configuration: config)

var allViolations: [Violation] = []
for root in opts.roots {
    let files = FileWalker.swiftFiles(under: root)
    for file in files {
        if config.shouldIgnore(file.relative) { continue }
        // Display path: relative to the root for short error messages.
        let display = file.relative.isEmpty ? file.absolute : file.relative
        allViolations.append(contentsOf: scanner.scanFile(at: file.absolute, displayPath: display))
    }
}

if !opts.quiet && !allViolations.isEmpty {
    let output = Reporter.render(allViolations, format: opts.format, strict: opts.strict)
    print(output)
}

if !allViolations.isEmpty {
    if opts.strict {
        FileHandle.standardError.write(Data("hudlint: \(allViolations.count) violation(s) — failing build.\n".utf8))
        exit(1)
    } else {
        FileHandle.standardError.write(Data("hudlint: \(allViolations.count) violation(s) (warning mode).\n".utf8))
    }
}

exit(0)
