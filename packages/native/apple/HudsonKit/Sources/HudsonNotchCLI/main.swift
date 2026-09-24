#if os(macOS)
import Darwin
import Foundation
import HudsonNotchCore

/// `hudson-notch` — talk to a running notch from a shell.
///
///     hudson-notch post --id build --title "Building" --state working --progress 0.4
///     hudson-notch ask --title "Keep the old link?" --choice keep:Keep:primary --choice later:Later:cancel
///     hudson-notch dismiss build
///     hudson-notch listen
@main
struct HudsonNotchCommand {
    static func main() {
        do {
            let code = try run(Array(CommandLine.arguments.dropFirst()))
            Darwin.exit(code)
        } catch {
            FileHandle.standardError.write(Data("hudson-notch: \(error.localizedDescription)\n".utf8))
            Darwin.exit(1)
        }
    }

    static func run(_ arguments: [String]) throws -> Int32 {
        var parser = Arguments(arguments)
        guard let command = parser.next() else {
            print(usage)
            return 0
        }

        switch command {
        case "post", "send":
            let (activity, options) = try parseActivity(&parser, defaultState: .notice)
            try options.client.send(.post(activity))
        case "ask":
            let (activity, options) = try parseActivity(&parser, defaultState: .waiting)
            do {
                let response = try options.client.ask(activity, timeout: options.timeout)
                print(try responseJSON(response))
                if case .dismissed = response { return 2 }
            } catch HudNotchSocketError.timedOut {
                FileHandle.standardError.write(Data("hudson-notch: no answer before the timeout\n".utf8))
                return 3
            }
        case "dismiss":
            var options = Options()
            var id: String?
            while let argument = parser.next() {
                if try options.consume(argument, &parser) { continue }
                if argument == "--id" { id = try parser.value(after: argument) } else { id = argument }
            }
            guard let id else { throw CLIError("dismiss needs an activity id") }
            try options.client.send(.dismiss(id: id))
        case "pulse":
            var options = Options()
            while let argument = parser.next() {
                guard try options.consume(argument, &parser) else { throw CLIError("Unknown option \(argument)") }
            }
            try options.client.send(.pulse)
        case "listen":
            var options = Options()
            while let argument = parser.next() {
                guard try options.consume(argument, &parser) else { throw CLIError("Unknown option \(argument)") }
            }
            try options.client.subscribe { response in
                if let line = try? responseJSON(response) {
                    print(line)
                    fflush(stdout)
                }
                return true
            }
        case "socket-path":
            print(HudNotchSocket.defaultURL.path)
        case "-h", "--help", "help":
            print(usage)
        default:
            throw CLIError("Unknown command \(command). Run hudson-notch help.")
        }
        return 0
    }

    // MARK: Parsing

    static func parseActivity(_ parser: inout Arguments, defaultState: HudNotchActivityState) throws -> (HudNotchActivity, Options) {
        var options = Options()
        var id: String?
        var source = "cli"
        var title: String?
        var detail: String?
        var state = defaultState
        var tone: HudNotchTone?
        var progress: Double?
        var choices: [HudNotchChoice] = []
        var replyPrompt: String?
        var link: HudNotchLink?
        var ttl: TimeInterval?
        var json: String?

        while let argument = parser.next() {
            if try options.consume(argument, &parser) { continue }
            switch argument {
            case "--json": json = try parser.value(after: argument)
            case "--id": id = try parser.value(after: argument)
            case "--source", "-s": source = try parser.value(after: argument)
            case "--title", "-t": title = try parser.value(after: argument)
            case "--detail", "--body", "-d": detail = try parser.value(after: argument)
            case "--state":
                let raw = try parser.value(after: argument).lowercased()
                guard let parsed = HudNotchActivityState(rawValue: raw) else {
                    throw CLIError("Unknown state \(raw). Use notice, working, waiting, done or failed.")
                }
                state = parsed
            case "--tone":
                let raw = try parser.value(after: argument).lowercased()
                guard let parsed = HudNotchTone(rawValue: raw) else {
                    throw CLIError("Unknown tone \(raw). Use info, success, warning or error.")
                }
                tone = parsed
            case "--progress":
                let raw = try parser.value(after: argument)
                guard let value = Double(raw) else { throw CLIError("--progress takes a number from 0 to 1.") }
                progress = value
            case "--choice", "-c":
                choices.append(try parseChoice(parser.value(after: argument), index: choices.count))
            case "--reply", "--reply-prompt":
                replyPrompt = try parser.value(after: argument)
            case "--link":
                let raw = try parser.value(after: argument)
                if let split = raw.range(of: "=") {
                    link = HudNotchLink(title: String(raw[..<split.lowerBound]), url: String(raw[split.upperBound...]))
                } else {
                    link = HudNotchLink(title: "Open", url: raw)
                }
            case "--ttl":
                let raw = try parser.value(after: argument)
                guard let value = TimeInterval(raw) else { throw CLIError("--ttl takes seconds.") }
                ttl = value
            default:
                throw CLIError("Unknown option \(argument)")
            }
        }

        if let json {
            var activity = try HudNotchWire.makeDecoder().decode(HudNotchActivity.self, from: Data(json.utf8))
            if defaultState == .waiting { activity.state = .waiting }
            return (activity, options)
        }
        guard let title else { throw CLIError("Needs --title.") }
        let activity = HudNotchActivity(
            id: id ?? UUID().uuidString,
            source: source,
            title: title,
            detail: detail,
            state: state,
            tone: tone,
            progress: progress,
            choices: choices,
            replyPrompt: replyPrompt,
            link: link,
            ttl: ttl
        )
        return (activity, options)
    }

    /// `id:Title[:role]`, or just `Title` (the id is derived from it).
    static func parseChoice(_ raw: String, index: Int) throws -> HudNotchChoice {
        let parts = raw.split(separator: ":", maxSplits: 2, omittingEmptySubsequences: false).map(String.init)
        switch parts.count {
        case 1:
            let id = raw.lowercased().replacingOccurrences(of: " ", with: "-")
            return HudNotchChoice(id: id.isEmpty ? "choice-\(index)" : id, title: raw)
        case 2:
            return HudNotchChoice(id: parts[0], title: parts[1])
        default:
            guard let role = HudNotchChoice.Role(rawValue: parts[2].lowercased()) else {
                throw CLIError("Unknown choice role \(parts[2]). Use primary, normal or cancel.")
            }
            return HudNotchChoice(id: parts[0], title: parts[1], role: role)
        }
    }

    static func responseJSON(_ response: HudNotchResponse) throws -> String {
        var data = try HudNotchWire.encodeResponse(response)
        if data.last == 0x0A { data.removeLast() }
        return String(decoding: data, as: UTF8.self)
    }

    static let usage = """
    Usage: hudson-notch <command> [options]

    Commands:
      post        Add or update an activity (same --id updates in place)
      ask         Post a waiting activity and print the answer as JSON
                  Exit 0 on a reply, 2 if dismissed, 3 on timeout
      dismiss ID  Remove an activity
      pulse       Open the notch briefly
      listen      Print every reply and dismissal as JSON lines
      socket-path Print the default socket path

    Activity options:
      --id ID                 Stable id; reuse it to update
      --title, -t TEXT        Required
      --detail, -d TEXT
      --source, -s NAME       Shown as the eyebrow (default: cli)
      --state STATE           notice | working | waiting | done | failed
      --tone TONE             info | success | warning | error
      --progress 0..1
      --choice, -c id:Title[:primary|normal|cancel]   Repeatable
      --reply-prompt TEXT     Adds a text field with this placeholder
      --link [Title=]URL
      --ttl SECONDS           How long the notch stays open
      --json JSON             A whole activity as JSON

    Connection:
      --socket PATH           Default: \(HudNotchSocket.defaultURL.path)
      --timeout SECONDS       ask only
    """
}

struct Options {
    var socket: String?
    var timeout: TimeInterval?

    var client: HudNotchClient {
        HudNotchClient(socketURL: socket.map { URL(fileURLWithPath: ($0 as NSString).expandingTildeInPath) } ?? HudNotchSocket.defaultURL)
    }

    mutating func consume(_ argument: String, _ parser: inout Arguments) throws -> Bool {
        switch argument {
        case "--socket":
            socket = try parser.value(after: argument)
            return true
        case "--timeout":
            let raw = try parser.value(after: argument)
            guard let value = TimeInterval(raw) else { throw CLIError("--timeout takes seconds.") }
            timeout = value
            return true
        default:
            return false
        }
    }
}

struct Arguments {
    private var remaining: ArraySlice<String>
    init(_ arguments: [String]) { remaining = arguments[...] }

    mutating func next() -> String? { remaining.popFirst() }

    mutating func value(after flag: String) throws -> String {
        guard let value = remaining.popFirst() else { throw CLIError("\(flag) needs a value.") }
        return value
    }
}

struct CLIError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}
#else
@main
struct HudsonNotchCommand {
    static func main() { print("hudson-notch runs on macOS only.") }
}
#endif
