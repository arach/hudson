import CryptoKit
import Foundation

/// Constants and key helpers for Hudson's Noise transport.
///
/// Hudson implements the `Noise_XX_25519_AESGCM_SHA256` and
/// `Noise_IK_25519_AESGCM_SHA256` protocol names. Noise messages are limited to
/// 65,535 bytes; an authenticated transport message therefore carries at most
/// 65,519 plaintext bytes after its 16-byte AES-GCM tag.
public enum HudNoise {
    public static let maximumMessageLength = 65_535
    public static let authenticationTagLength = 16
    public static let maximumPlaintextLength = maximumMessageLength - authenticationTagLength

    public static func generateKeyPair() -> HudNoiseKeyPair {
        HudNoiseKeyPair(generatedPrivateKey: Curve25519.KeyAgreement.PrivateKey())
    }

    public static func keyPair(privateKeyData: Data) throws -> HudNoiseKeyPair {
        try HudNoiseKeyPair(privateKeyData: privateKeyData)
    }
}

public struct HudNoiseKeyPair: Sendable {
    public let publicKey: Data
    public let privateKey: Curve25519.KeyAgreement.PrivateKey

    public var privateKeyData: Data {
        privateKey.rawRepresentation
    }

    /// Restores a key pair from an X25519 private key's 32-byte raw
    /// representation.
    public init(privateKeyData: Data) throws {
        do {
            let privateKey = try Curve25519.KeyAgreement.PrivateKey(
                rawRepresentation: privateKeyData
            )
            self.init(generatedPrivateKey: privateKey)
        } catch {
            throw HudNoiseError.invalidKey("X25519 private keys must be 32 bytes")
        }
    }

    /// Creates a key pair while verifying that the supplied public and private
    /// values belong together. Prefer `HudNoise.generateKeyPair()` for new
    /// identities.
    public init(
        publicKey: Data,
        privateKey: Curve25519.KeyAgreement.PrivateKey
    ) throws {
        guard publicKey.count == HudNoiseConstants.dhLength else {
            throw HudNoiseError.invalidKey("X25519 public keys must be 32 bytes")
        }
        guard publicKey == privateKey.publicKey.rawRepresentation else {
            throw HudNoiseError.invalidKey("X25519 public and private keys do not match")
        }
        self.publicKey = publicKey
        self.privateKey = privateKey
    }

    fileprivate init(generatedPrivateKey privateKey: Curve25519.KeyAgreement.PrivateKey) {
        self.publicKey = privateKey.publicKey.rawRepresentation
        self.privateKey = privateKey
    }
}

public enum HudNoiseRole: Sendable {
    case initiator
    case responder
}

public enum HudNoiseHandshakePattern: String, Sendable {
    case xx = "XX"
    case ik = "IK"
}

/// A completed, bidirectional Noise transport.
///
/// The actor is the nonce boundary: concurrent callers cannot reuse or reorder
/// mutation of either directional counter. A failed authentication does not
/// advance the receive nonce, allowing the owner to close the channel or retry
/// the exact frame without silently desynchronizing state.
public actor HudNoiseSession {
    public nonisolated let remoteStaticKey: Data
    public nonisolated let handshakeHash: Data

    private var sendCipher: HudNoiseCipherState
    private var receiveCipher: HudNoiseCipherState

    fileprivate init(
        sendCipher: HudNoiseCipherState,
        receiveCipher: HudNoiseCipherState,
        remoteStaticKey: Data,
        handshakeHash: Data
    ) {
        self.sendCipher = sendCipher
        self.receiveCipher = receiveCipher
        self.remoteStaticKey = remoteStaticKey
        self.handshakeHash = handshakeHash
    }

    public func encrypt(_ plaintext: Data) throws -> Data {
        try sendCipher.encrypt(associatedData: Data(), plaintext: plaintext)
    }

    public func decrypt(_ ciphertext: Data) throws -> Data {
        try receiveCipher.decrypt(associatedData: Data(), ciphertext: ciphertext)
    }

    // Internal diagnostics used to prove nonce behavior without exposing
    // counters as part of the stable transport API.
    var sendNonce: UInt64 { sendCipher.nonce }
    var receiveNonce: UInt64 { receiveCipher.nonce }
}

/// Executes one Noise XX or IK handshake.
///
/// Handshake state is intentionally synchronous and single-owner. Once
/// finalized, transport operations move into `HudNoiseSession`, whose actor
/// isolation serializes both nonce counters.
public final class HudNoiseHandshake {
    private var symmetricState: HudNoiseSymmetricState
    private let localStatic: HudNoiseKeyPair
    private var localEphemeral: HudNoiseKeyPair?
    private var remoteStatic: Data?
    private var remoteEphemeral: Data?
    private let role: HudNoiseRole
    private let messages: [[HudNoiseToken]]
    private let ephemeralKeyGenerator: () -> HudNoiseKeyPair
    private var messageIndex = 0
    private var hasFailed = false
    private var hasFinalized = false

    /// Creates a handshake and mixes the application prologue into its channel
    /// binding before processing any pre-messages.
    ///
    /// IK initiators must supply the responder's authenticated static public
    /// key. XX and IK responders learn their peer's static key in-band and
    /// reject a redundant value to keep configuration unambiguous.
    public convenience init(
        pattern: HudNoiseHandshakePattern,
        role: HudNoiseRole,
        staticKey: HudNoiseKeyPair,
        remoteStaticKey: Data? = nil,
        prologue: Data = Data()
    ) throws {
        try self.init(
            pattern: pattern,
            role: role,
            staticKey: staticKey,
            remoteStaticKey: remoteStaticKey,
            prologue: prologue,
            ephemeralKeyGenerator: HudNoise.generateKeyPair
        )
    }

    /// Internal deterministic-key seam for interoperability vectors. Product
    /// callers always use the public initializer's cryptographically random
    /// generator.
    init(
        pattern: HudNoiseHandshakePattern,
        role: HudNoiseRole,
        staticKey: HudNoiseKeyPair,
        remoteStaticKey: Data? = nil,
        prologue: Data = Data(),
        ephemeralKeyGenerator: @escaping () -> HudNoiseKeyPair
    ) throws {
        switch (pattern, role, remoteStaticKey) {
        case (.ik, .initiator, .none):
            throw HudNoiseError.invalidConfiguration(
                "Noise IK initiators require the responder's static public key"
            )
        case (.ik, .initiator, .some(let key)):
            try HudNoiseValidation.validatePublicKey(key)
        case (_, _, .some):
            throw HudNoiseError.invalidConfiguration(
                "Only Noise IK initiators accept a preconfigured remote static key"
            )
        default:
            break
        }

        let definition = HudNoisePatterns.definition(for: pattern)
        var symmetricState = HudNoiseSymmetricState(
            protocolName: "Noise_\(pattern.rawValue)_25519_AESGCM_SHA256"
        )
        symmetricState.mixHash(prologue)

        self.symmetricState = symmetricState
        self.localStatic = staticKey
        self.remoteStatic = remoteStaticKey
        self.role = role
        self.messages = definition.messages
        self.ephemeralKeyGenerator = ephemeralKeyGenerator

        for preMessage in definition.preMessages {
            switch preMessage.owner {
            case .initiator:
                if role == .initiator {
                    self.symmetricState.mixHash(staticKey.publicKey)
                } else {
                    guard let remoteStaticKey else {
                        throw HudNoiseError.invalidConfiguration(
                            "The initiator static key is missing from the pre-message"
                        )
                    }
                    self.symmetricState.mixHash(remoteStaticKey)
                }
            case .responder:
                if role == .responder {
                    self.symmetricState.mixHash(staticKey.publicKey)
                } else {
                    guard let remoteStaticKey else {
                        throw HudNoiseError.invalidConfiguration(
                            "The responder static key is missing from the pre-message"
                        )
                    }
                    self.symmetricState.mixHash(remoteStaticKey)
                }
            }
        }
    }

    public var isMyTurnToSend: Bool {
        guard !isComplete else { return false }
        let senderIsInitiator = messageIndex.isMultiple(of: 2)
        return (role == .initiator) == senderIsInitiator
    }

    public var isComplete: Bool {
        messageIndex >= messages.count
    }

    public func writeMessage(payload: Data = Data()) throws -> Data {
        guard !hasFailed else { throw HudNoiseError.handshakeFailed }
        guard !hasFinalized else { throw HudNoiseError.handshakeAlreadyFinalized }
        guard !isComplete else { throw HudNoiseError.handshakeComplete }
        guard isMyTurnToSend else { throw HudNoiseError.notOurTurn }

        let payloadLimit = maximumPayloadLengthForCurrentMessage()
        guard payload.count <= payloadLimit else {
            throw HudNoiseError.plaintextTooLarge(
                maximum: payloadLimit,
                actual: payload.count
            )
        }

        do {
            var output = Data()
            for token in messages[messageIndex] {
                switch token {
                case .e:
                    let ephemeral = ephemeralKeyGenerator()
                    localEphemeral = ephemeral
                    output.append(ephemeral.publicKey)
                    symmetricState.mixHash(ephemeral.publicKey)
                case .s:
                    output.append(try symmetricState.encryptAndHash(localStatic.publicKey))
                case .ee, .es, .se, .ss:
                    try performKeyAgreement(token)
                }
            }

            output.append(try symmetricState.encryptAndHash(payload))
            guard output.count <= HudNoise.maximumMessageLength else {
                throw HudNoiseError.messageTooLarge(
                    maximum: HudNoise.maximumMessageLength,
                    actual: output.count
                )
            }

            messageIndex += 1
            return output
        } catch {
            hasFailed = true
            throw error
        }
    }

    public func readMessage(_ message: Data) throws -> Data {
        guard !hasFailed else { throw HudNoiseError.handshakeFailed }
        guard !hasFinalized else { throw HudNoiseError.handshakeAlreadyFinalized }
        guard !isComplete else { throw HudNoiseError.handshakeComplete }
        guard !isMyTurnToSend else { throw HudNoiseError.notTheirTurn }
        guard message.count <= HudNoise.maximumMessageLength else {
            throw HudNoiseError.messageTooLarge(
                maximum: HudNoise.maximumMessageLength,
                actual: message.count
            )
        }

        do {
            var offset = 0
            for token in messages[messageIndex] {
                switch token {
                case .e:
                    let key = try readBytes(
                        count: HudNoiseConstants.dhLength,
                        from: message,
                        offset: &offset
                    )
                    try HudNoiseValidation.validatePublicKey(key)
                    remoteEphemeral = key
                    symmetricState.mixHash(key)
                case .s:
                    let keyLength = HudNoiseConstants.dhLength
                        + (symmetricState.hasCipherKey ? HudNoise.authenticationTagLength : 0)
                    let encodedKey = try readBytes(
                        count: keyLength,
                        from: message,
                        offset: &offset
                    )
                    let key = try symmetricState.decryptAndHash(encodedKey)
                    try HudNoiseValidation.validatePublicKey(key)
                    remoteStatic = key
                case .ee, .es, .se, .ss:
                    try performKeyAgreement(token)
                }
            }

            let payload = message.subdata(in: offset..<message.count)
            let plaintext = try symmetricState.decryptAndHash(payload)
            guard plaintext.count <= HudNoise.maximumPlaintextLength else {
                throw HudNoiseError.plaintextTooLarge(
                    maximum: HudNoise.maximumPlaintextLength,
                    actual: plaintext.count
                )
            }

            messageIndex += 1
            return plaintext
        } catch {
            hasFailed = true
            throw error
        }
    }

    public func finalize() throws -> HudNoiseSession {
        guard !hasFailed else { throw HudNoiseError.handshakeFailed }
        guard !hasFinalized else { throw HudNoiseError.handshakeAlreadyFinalized }
        guard isComplete else { throw HudNoiseError.handshakeNotComplete }
        guard let remoteStatic else { throw HudNoiseError.missingRemoteStaticKey }

        let (initiatorCipher, responderCipher) = symmetricState.split()
        let ciphers = role == .initiator
            ? (send: initiatorCipher, receive: responderCipher)
            : (send: responderCipher, receive: initiatorCipher)
        hasFinalized = true

        return HudNoiseSession(
            sendCipher: ciphers.send,
            receiveCipher: ciphers.receive,
            remoteStaticKey: remoteStatic,
            handshakeHash: symmetricState.handshakeHash
        )
    }

    private func maximumPayloadLengthForCurrentMessage() -> Int {
        var fixedLength = 0
        var hasCipherKey = symmetricState.hasCipherKey

        for token in messages[messageIndex] {
            switch token {
            case .e:
                fixedLength += HudNoiseConstants.dhLength
            case .s:
                fixedLength += HudNoiseConstants.dhLength
                if hasCipherKey {
                    fixedLength += HudNoise.authenticationTagLength
                }
            case .ee, .es, .se, .ss:
                hasCipherKey = true
            }
        }

        if hasCipherKey {
            fixedLength += HudNoise.authenticationTagLength
        }
        return min(
            HudNoise.maximumPlaintextLength,
            HudNoise.maximumMessageLength - fixedLength
        )
    }

    private func performKeyAgreement(_ token: HudNoiseToken) throws {
        let localKeyType: HudNoiseKeyType
        let remoteKeyType: HudNoiseKeyType
        if role == .initiator {
            localKeyType = token.initiatorKeyType
            remoteKeyType = token.responderKeyType
        } else {
            localKeyType = token.responderKeyType
            remoteKeyType = token.initiatorKeyType
        }

        let privateKey: Curve25519.KeyAgreement.PrivateKey
        switch localKeyType {
        case .ephemeral:
            guard let localEphemeral else {
                throw HudNoiseError.missingKey("local ephemeral for DH(\(token.rawValue))")
            }
            privateKey = localEphemeral.privateKey
        case .staticKey:
            privateKey = localStatic.privateKey
        }

        let publicKey: Data
        switch remoteKeyType {
        case .ephemeral:
            guard let remoteEphemeral else {
                throw HudNoiseError.missingKey("remote ephemeral for DH(\(token.rawValue))")
            }
            publicKey = remoteEphemeral
        case .staticKey:
            guard let remoteStatic else {
                throw HudNoiseError.missingKey("remote static for DH(\(token.rawValue))")
            }
            publicKey = remoteStatic
        }

        symmetricState.mixKey(
            try HudNoiseCrypto.diffieHellman(privateKey: privateKey, publicKey: publicKey)
        )
    }

    private func readBytes(
        count: Int,
        from message: Data,
        offset: inout Int
    ) throws -> Data {
        guard count >= 0, offset <= message.count, count <= message.count - offset else {
            throw HudNoiseError.messageTooShort
        }
        defer { offset += count }
        return message.subdata(in: offset..<(offset + count))
    }
}

public enum HudNoiseError: Error, Equatable, LocalizedError, Sendable {
    case invalidConfiguration(String)
    case invalidKey(String)
    case notOurTurn
    case notTheirTurn
    case handshakeComplete
    case handshakeNotComplete
    case handshakeAlreadyFinalized
    case handshakeFailed
    case missingRemoteStaticKey
    case missingKey(String)
    case messageTooShort
    case messageTooLarge(maximum: Int, actual: Int)
    case plaintextTooLarge(maximum: Int, actual: Int)
    case ciphertextTooShort(minimum: Int, actual: Int)
    case nonceExhausted
    case encryptionFailed(String)
    case decryptionFailed(String)
    case keyAgreementFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidConfiguration(let detail):
            return "Noise configuration is invalid: \(detail)."
        case .invalidKey(let detail):
            return "Noise key is invalid: \(detail)."
        case .notOurTurn:
            return "Noise handshake is not ready to send."
        case .notTheirTurn:
            return "Noise handshake is not ready to receive."
        case .handshakeComplete:
            return "Noise handshake is already complete."
        case .handshakeNotComplete:
            return "Noise handshake is not complete."
        case .handshakeAlreadyFinalized:
            return "Noise handshake was already finalized."
        case .handshakeFailed:
            return "Noise handshake previously failed and cannot be reused."
        case .missingRemoteStaticKey:
            return "Noise handshake did not establish the remote static key."
        case .missingKey(let detail):
            return "Noise handshake is missing \(detail)."
        case .messageTooShort:
            return "Noise handshake message is too short."
        case .messageTooLarge(let maximum, let actual):
            return "Noise message has \(actual) bytes; the maximum is \(maximum)."
        case .plaintextTooLarge(let maximum, let actual):
            return "Noise plaintext has \(actual) bytes; the maximum is \(maximum)."
        case .ciphertextTooShort(let minimum, let actual):
            return "Noise ciphertext has \(actual) bytes; at least \(minimum) are required."
        case .nonceExhausted:
            return "Noise cipher nonce is exhausted."
        case .encryptionFailed(let detail):
            return "Noise encryption failed: \(detail)."
        case .decryptionFailed(let detail):
            return "Noise decryption failed: \(detail)."
        case .keyAgreementFailed(let detail):
            return "Noise key agreement failed: \(detail)."
        }
    }
}

private enum HudNoiseConstants {
    static let dhLength = 32
    static let hashLength = 32
}

private enum HudNoiseValidation {
    static func validatePublicKey(_ key: Data) throws {
        guard key.count == HudNoiseConstants.dhLength else {
            throw HudNoiseError.invalidKey("X25519 public keys must be 32 bytes")
        }
        do {
            _ = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: key)
        } catch {
            throw HudNoiseError.invalidKey("X25519 public key representation is malformed")
        }
    }
}

private enum HudNoiseCrypto {
    static func diffieHellman(
        privateKey: Curve25519.KeyAgreement.PrivateKey,
        publicKey: Data
    ) throws -> Data {
        try HudNoiseValidation.validatePublicKey(publicKey)
        do {
            let remotePublicKey = try Curve25519.KeyAgreement.PublicKey(
                rawRepresentation: publicKey
            )
            let secret = try privateKey.sharedSecretFromKeyAgreement(with: remotePublicKey)
            return secret.withUnsafeBytes { Data($0) }
        } catch {
            throw HudNoiseError.keyAgreementFailed("X25519 rejected the remote public key")
        }
    }

    static func hkdf(salt: Data, inputKeyMaterial: Data, length: Int) -> Data {
        let key = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: inputKeyMaterial),
            salt: salt,
            info: Data(),
            outputByteCount: length
        )
        return key.withUnsafeBytes { Data($0) }
    }
}

private struct HudNoiseCipherState {
    var key: SymmetricKey?
    var nonce: UInt64 = 0

    var hasKey: Bool { key != nil }

    mutating func encrypt(associatedData: Data, plaintext: Data) throws -> Data {
        guard plaintext.count <= HudNoise.maximumPlaintextLength else {
            throw HudNoiseError.plaintextTooLarge(
                maximum: HudNoise.maximumPlaintextLength,
                actual: plaintext.count
            )
        }
        guard let key else { return plaintext }
        guard nonce < UInt64.max else { throw HudNoiseError.nonceExhausted }

        do {
            let sealed = try AES.GCM.seal(
                plaintext,
                using: key,
                nonce: AES.GCM.Nonce(data: nonceData),
                authenticating: associatedData
            )
            nonce += 1
            return sealed.ciphertext + sealed.tag
        } catch let error as HudNoiseError {
            throw error
        } catch {
            throw HudNoiseError.encryptionFailed("AES-GCM could not seal the plaintext")
        }
    }

    mutating func decrypt(associatedData: Data, ciphertext: Data) throws -> Data {
        guard let key else {
            guard ciphertext.count <= HudNoise.maximumPlaintextLength else {
                throw HudNoiseError.plaintextTooLarge(
                    maximum: HudNoise.maximumPlaintextLength,
                    actual: ciphertext.count
                )
            }
            return ciphertext
        }
        guard ciphertext.count <= HudNoise.maximumMessageLength else {
            throw HudNoiseError.messageTooLarge(
                maximum: HudNoise.maximumMessageLength,
                actual: ciphertext.count
            )
        }
        guard ciphertext.count >= HudNoise.authenticationTagLength else {
            throw HudNoiseError.ciphertextTooShort(
                minimum: HudNoise.authenticationTagLength,
                actual: ciphertext.count
            )
        }
        guard nonce < UInt64.max else { throw HudNoiseError.nonceExhausted }

        do {
            let bodyEnd = ciphertext.count - HudNoise.authenticationTagLength
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonceData),
                ciphertext: ciphertext.prefix(bodyEnd),
                tag: ciphertext.suffix(HudNoise.authenticationTagLength)
            )
            let plaintext = try AES.GCM.open(
                box,
                using: key,
                authenticating: associatedData
            )
            nonce += 1
            return plaintext
        } catch let error as HudNoiseError {
            throw error
        } catch {
            throw HudNoiseError.decryptionFailed("authentication failed")
        }
    }

    private var nonceData: Data {
        var data = Data(repeating: 0, count: 12)
        // Noise Protocol Framework rev. 34, section 12.4: AESGCM uses four
        // zero bytes followed by the big-endian encoding of the UInt64 nonce.
        var bigEndianNonce = nonce.bigEndian
        withUnsafeBytes(of: &bigEndianNonce) { bytes in
            data.replaceSubrange(4..<12, with: bytes)
        }
        return data
    }
}

private struct HudNoiseSymmetricState {
    private var chainingKey: Data
    private var hash: Data
    private var cipher = HudNoiseCipherState()

    init(protocolName: String) {
        let name = Data(protocolName.utf8)
        if name.count <= HudNoiseConstants.hashLength {
            var padded = Data(repeating: 0, count: HudNoiseConstants.hashLength)
            padded.replaceSubrange(0..<name.count, with: name)
            hash = padded
        } else {
            hash = Data(SHA256.hash(data: name))
        }
        chainingKey = hash
    }

    var hasCipherKey: Bool { cipher.hasKey }
    var handshakeHash: Data { hash }

    mutating func mixKey(_ inputKeyMaterial: Data) {
        let output = HudNoiseCrypto.hkdf(
            salt: chainingKey,
            inputKeyMaterial: inputKeyMaterial,
            length: 64
        )
        chainingKey = Data(output.prefix(HudNoiseConstants.hashLength))
        cipher = HudNoiseCipherState(
            key: SymmetricKey(data: output.suffix(HudNoiseConstants.hashLength))
        )
    }

    mutating func mixHash(_ data: Data) {
        var transcript = Data(capacity: hash.count + data.count)
        transcript.append(hash)
        transcript.append(data)
        hash = Data(SHA256.hash(data: transcript))
    }

    mutating func encryptAndHash(_ plaintext: Data) throws -> Data {
        let ciphertext = try cipher.encrypt(associatedData: hash, plaintext: plaintext)
        mixHash(ciphertext)
        return ciphertext
    }

    mutating func decryptAndHash(_ ciphertext: Data) throws -> Data {
        let plaintext = try cipher.decrypt(associatedData: hash, ciphertext: ciphertext)
        mixHash(ciphertext)
        return plaintext
    }

    func split() -> (HudNoiseCipherState, HudNoiseCipherState) {
        let output = HudNoiseCrypto.hkdf(
            salt: chainingKey,
            inputKeyMaterial: Data(),
            length: 64
        )
        return (
            HudNoiseCipherState(
                key: SymmetricKey(data: output.prefix(HudNoiseConstants.hashLength))
            ),
            HudNoiseCipherState(
                key: SymmetricKey(data: output.suffix(HudNoiseConstants.hashLength))
            )
        )
    }
}

private enum HudNoiseKeyType {
    case ephemeral
    case staticKey
}

private enum HudNoiseToken: String {
    case e
    case s
    case ee
    case es
    case se
    case ss

    var initiatorKeyType: HudNoiseKeyType {
        switch self {
        case .ee, .es:
            return .ephemeral
        case .se, .ss:
            return .staticKey
        case .e, .s:
            preconditionFailure("Key tokens do not describe a DH operation")
        }
    }

    var responderKeyType: HudNoiseKeyType {
        switch self {
        case .ee, .se:
            return .ephemeral
        case .es, .ss:
            return .staticKey
        case .e, .s:
            preconditionFailure("Key tokens do not describe a DH operation")
        }
    }
}

private struct HudNoisePreMessage {
    let owner: HudNoiseRole
}

private struct HudNoisePatternDefinition {
    let preMessages: [HudNoisePreMessage]
    let messages: [[HudNoiseToken]]
}

private enum HudNoisePatterns {
    static func definition(for pattern: HudNoiseHandshakePattern) -> HudNoisePatternDefinition {
        switch pattern {
        case .xx:
            return HudNoisePatternDefinition(
                preMessages: [],
                messages: [
                    [.e],
                    [.e, .ee, .s, .es],
                    [.s, .se],
                ]
            )
        case .ik:
            return HudNoisePatternDefinition(
                preMessages: [HudNoisePreMessage(owner: .responder)],
                messages: [
                    [.e, .es, .s, .ss],
                    [.e, .ee, .se],
                ]
            )
        }
    }
}
