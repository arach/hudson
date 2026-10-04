import Foundation
import HudsonConversation

/// Scripted socket: tests push server messages and inspect parsed client
/// sends. No network is involved anywhere in this suite.
actor FixtureSocket: HudConversationSocket {
    private var incoming: [Data] = []
    private var receivers: [CheckedContinuation<Data, Error>] = []
    private(set) var sent: [[String: Any]] = []
    private var sentWaiters: [(count: Int, waiter: CheckedContinuation<Void, Never>)] = []
    private var closedByClient = false

    func push(_ json: [String: Any]) {
        let data = (try? JSONSerialization.data(withJSONObject: json)) ?? Data()
        if let receiver = receivers.first {
            receivers.removeFirst()
            receiver.resume(returning: data)
        } else {
            incoming.append(data)
        }
    }

    func send(_ data: Data) throws {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            sent.append(json)
            for entry in sentWaiters where sent.count >= entry.count {
                entry.waiter.resume()
            }
            sentWaiters.removeAll { sent.count >= $0.count }
        }
    }

    func receive() async throws -> Data {
        if !incoming.isEmpty { return incoming.removeFirst() }
        return try await withCheckedThrowingContinuation { receivers.append($0) }
    }

    func close() {
        closedByClient = true
        for receiver in receivers { receiver.resume(throwing: CancellationError()) }
        receivers = []
    }

    func waitForSent(count: Int) async {
        if sent.count >= count { return }
        await withCheckedContinuation { sentWaiters.append((count, $0)) }
    }

    func sentMessages() -> [[String: Any]] { sent }
    func wasClosed() -> Bool { closedByClient }
}

struct FixtureCredentials: HudConversationCredentialResolver {
    var value: String?
    func credential(for reference: HudConversationCredentialReference) async throws -> Data {
        Data((value ?? "").utf8)
    }
}
