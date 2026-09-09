import CryptoKit
import Foundation
import Testing
@testable import HudsonBridge

@Suite("HudNoise")
struct HudNoiseTests {
    @Test("XX authenticates both static keys and binds the transcript")
    func xxHandshake() throws {
        let initiatorKey = HudNoise.generateKeyPair()
        let responderKey = HudNoise.generateKeyPair()
        let prologue = bytes("com.hudson.linea.transfer/v1")
        let initiator = try HudNoiseHandshake(
            pattern: .xx,
            role: .initiator,
            staticKey: initiatorKey,
            prologue: prologue
        )
        let responder = try HudNoiseHandshake(
            pattern: .xx,
            role: .responder,
            staticKey: responderKey,
            prologue: prologue
        )

        let messageOne = try initiator.writeMessage(payload: bytes("offer"))
        #expect(try responder.readMessage(messageOne) == bytes("offer"))

        let messageTwo = try responder.writeMessage(payload: bytes("approval"))
        #expect(try initiator.readMessage(messageTwo) == bytes("approval"))

        let messageThree = try initiator.writeMessage(payload: bytes("ready"))
        #expect(try responder.readMessage(messageThree) == bytes("ready"))
        #expect(initiator.isComplete)
        #expect(responder.isComplete)

        let initiatorSession = try initiator.finalize()
        let responderSession = try responder.finalize()
        #expect(initiatorSession.remoteStaticKey == responderKey.publicKey)
        #expect(responderSession.remoteStaticKey == initiatorKey.publicKey)
        #expect(initiatorSession.handshakeHash == responderSession.handshakeHash)
        #expect(initiatorSession.handshakeHash.count == 32)
    }

    @Test("IK authenticates a known responder in two messages")
    func ikHandshake() throws {
        let initiatorKey = HudNoise.generateKeyPair()
        let responderKey = HudNoise.generateKeyPair()
        let initiator = try HudNoiseHandshake(
            pattern: .ik,
            role: .initiator,
            staticKey: initiatorKey,
            remoteStaticKey: responderKey.publicKey,
            prologue: bytes("trusted-device/v1")
        )
        let responder = try HudNoiseHandshake(
            pattern: .ik,
            role: .responder,
            staticKey: responderKey,
            prologue: bytes("trusted-device/v1")
        )

        let messageOne = try initiator.writeMessage(payload: bytes("request"))
        #expect(try responder.readMessage(messageOne) == bytes("request"))
        let messageTwo = try responder.writeMessage(payload: bytes("accepted"))
        #expect(try initiator.readMessage(messageTwo) == bytes("accepted"))

        let initiatorSession = try initiator.finalize()
        let responderSession = try responder.finalize()
        #expect(initiatorSession.remoteStaticKey == responderKey.publicKey)
        #expect(responderSession.remoteStaticKey == initiatorKey.publicKey)
        #expect(initiatorSession.handshakeHash == responderSession.handshakeHash)
    }

    @Test("XX interoperates with the Noise-C AESGCM reference vector")
    func noiseCAESGCMReferenceVector() async throws {
        // Noise-C's public basic vector, pinned at cfe25410979a87391bb9ac8d4d4bef64e9f268c6:
        // https://github.com/rweather/noise-c/blob/cfe25410979a87391bb9ac8d4d4bef64e9f268c6/tests/vector/noise-c-basic.txt
        // The final responder transport ciphertext uses directional nonce 1,
        // so this test distinguishes AESGCM's required big-endian nonce from
        // the little-endian encoding used by ChaChaPoly.
        let initiatorStatic = try HudNoise.keyPair(privateKeyData: hex(
            "e61ef9919cde45dd5f82166404bd08e38bceb5dfdfded0a34c8df7ed542214d1"
        ))
        let initiatorEphemeral = try HudNoise.keyPair(privateKeyData: hex(
            "893e28b9dc6ca8d611ab664754b8ceb7bac5117349a4439a6b0569da977c464a"
        ))
        let responderStatic = try HudNoise.keyPair(privateKeyData: hex(
            "4a3acbfdb163dec651dfa3194dece676d437029c62a408b4c5ea9114246e4893"
        ))
        let responderEphemeral = try HudNoise.keyPair(privateKeyData: hex(
            "bbdb4cdbd309f1a1f2e1456967fe288cadd6f712d65dc7b7793d5e63da6b375b"
        ))
        let prologue = try hex("50726f6c6f677565313233")
        let payloads = [
            try hex("4c756477696720766f6e204d69736573"),
            try hex("4d757272617920526f746862617264"),
            try hex("462e20412e20486179656b"),
            try hex("4361726c204d656e676572"),
            try hex("4a65616e2d426170746973746520536179"),
            try hex("457567656e2042f6686d20766f6e2042617765726b"),
        ]
        let ciphertexts = [
            try hex("""
                ca35def5ae56cec33dc2036731ab14896bc4c75dbb07a61f879f8e3afa4c7944
                4c756477696720766f6e204d69736573
                """),
            try hex("""
                95ebc60d2b1fa672c1f46a8aa265ef51bfe38e7ccb39ec5be34069f144808843
                757117acceb05bd7a45733bc22015c97a9d0cbaf41b80446d5988ff5127235d78
                c9ea8b1c117179204c8a49f9a83a7f640d01e028ba793fc059f2724a83af08e9
                93c1d87032f536390f1d612be65f7
                """),
            try hex("""
                c90f1cf77eba4e50edb038991565e36c9758943a989229b6051244dc4fbecb69
                28dadfe5492c3bf6aab568b11ddc6ebdcb6a328ececc9ce6ce84c336e421a792
                bc6eaca1d9d2c93636f8ff
                """),
            try hex("bc3fa77f6aca3e8466d7dc6bea10013e88a6a29add5132b461806c"),
            try hex("250b01074cdfe0df2ecf8ccbf1737b15a2ddb5b52fd9a396604e9c793cee3b3bb9"),
            try hex("""
                449d4d433b3cdc3d02bf6fc881774b9df54366ebcffb9689bb13f14709822cd7
                ef42bcdb4d
                """),
        ]

        let initiator = try HudNoiseHandshake(
            pattern: .xx,
            role: .initiator,
            staticKey: initiatorStatic,
            prologue: prologue,
            ephemeralKeyGenerator: { initiatorEphemeral }
        )
        let responder = try HudNoiseHandshake(
            pattern: .xx,
            role: .responder,
            staticKey: responderStatic,
            prologue: prologue,
            ephemeralKeyGenerator: { responderEphemeral }
        )

        let messageOne = try initiator.writeMessage(payload: payloads[0])
        #expect(messageOne == ciphertexts[0])
        #expect(try responder.readMessage(messageOne) == payloads[0])
        let messageTwo = try responder.writeMessage(payload: payloads[1])
        #expect(messageTwo == ciphertexts[1])
        #expect(try initiator.readMessage(messageTwo) == payloads[1])
        let messageThree = try initiator.writeMessage(payload: payloads[2])
        #expect(messageThree == ciphertexts[2])
        #expect(try responder.readMessage(messageThree) == payloads[2])

        let initiatorSession = try initiator.finalize()
        let responderSession = try responder.finalize()
        let expectedHandshakeHash = try hex(
            "b1fee4b75a0da34a3d1e338b093de8e46801eeafd1af0a7185b020cd27007ce4"
        )
        #expect(initiatorSession.handshakeHash == expectedHandshakeHash)
        #expect(responderSession.handshakeHash == expectedHandshakeHash)

        let responderTransportZero = try await responderSession.encrypt(payloads[3])
        #expect(responderTransportZero == ciphertexts[3])
        #expect(try await initiatorSession.decrypt(responderTransportZero) == payloads[3])
        let initiatorTransportZero = try await initiatorSession.encrypt(payloads[4])
        #expect(initiatorTransportZero == ciphertexts[4])
        #expect(try await responderSession.decrypt(initiatorTransportZero) == payloads[4])
        let responderTransportOne = try await responderSession.encrypt(payloads[5])
        #expect(responderTransportOne == ciphertexts[5])
        #expect(try await initiatorSession.decrypt(responderTransportOne) == payloads[5])
    }

    @Test("transport encrypts traffic in both directions")
    func bidirectionalTransport() async throws {
        let sessions = try completeXX()
        let request = bytes("paper payload")
        let response = bytes("stored receipt")

        let requestCiphertext = try await sessions.initiator.encrypt(request)
        #expect(requestCiphertext != request)
        #expect(try await sessions.responder.decrypt(requestCiphertext) == request)

        let responseCiphertext = try await sessions.responder.encrypt(response)
        #expect(responseCiphertext != response)
        #expect(try await sessions.initiator.decrypt(responseCiphertext) == response)
    }

    @Test("transport rejects tampering and truncation without consuming a nonce")
    func transportIntegrity() async throws {
        let sessions = try completeXX()
        let plaintext = bytes("first frame")
        let ciphertext = try await sessions.initiator.encrypt(plaintext)
        var tampered = ciphertext
        tampered[tampered.startIndex] ^= 0x01

        let tamperError = await capturedNoiseError {
            try await sessions.responder.decrypt(tampered)
        }
        #expect(tamperError == .decryptionFailed("authentication failed"))
        #expect(await sessions.responder.receiveNonce == 0)
        #expect(try await sessions.responder.decrypt(ciphertext) == plaintext)

        let secondPlaintext = bytes("second frame")
        let secondCiphertext = try await sessions.initiator.encrypt(secondPlaintext)
        let truncated = Data(secondCiphertext.prefix(HudNoise.authenticationTagLength - 1))
        let truncationError = await capturedNoiseError {
            try await sessions.responder.decrypt(truncated)
        }
        #expect(
            truncationError == .ciphertextTooShort(
                minimum: HudNoise.authenticationTagLength,
                actual: HudNoise.authenticationTagLength - 1
            )
        )
        #expect(await sessions.responder.receiveNonce == 1)
        #expect(try await sessions.responder.decrypt(secondCiphertext) == secondPlaintext)
    }

    @Test("transport nonces are directional and messages must stay ordered")
    func nonceOrdering() async throws {
        let sessions = try completeXX()
        let first = try await sessions.initiator.encrypt(bytes("zero"))
        let second = try await sessions.initiator.encrypt(bytes("one"))
        #expect(await sessions.initiator.sendNonce == 2)
        #expect(await sessions.responder.receiveNonce == 0)

        let outOfOrderError = await capturedNoiseError {
            try await sessions.responder.decrypt(second)
        }
        #expect(outOfOrderError == .decryptionFailed("authentication failed"))
        #expect(await sessions.responder.receiveNonce == 0)

        #expect(try await sessions.responder.decrypt(first) == bytes("zero"))
        #expect(await sessions.responder.receiveNonce == 1)
        #expect(try await sessions.responder.decrypt(second) == bytes("one"))
        #expect(await sessions.responder.receiveNonce == 2)

        let reverse = try await sessions.responder.encrypt(bytes("reverse-zero"))
        #expect(await sessions.responder.sendNonce == 1)
        #expect(try await sessions.initiator.decrypt(reverse) == bytes("reverse-zero"))
        #expect(await sessions.initiator.receiveNonce == 1)
    }

    @Test("different prologues cannot complete one channel")
    func prologueMismatch() throws {
        let initiator = try HudNoiseHandshake(
            pattern: .xx,
            role: .initiator,
            staticKey: HudNoise.generateKeyPair(),
            prologue: bytes("linea-transfer/v1")
        )
        let responder = try HudNoiseHandshake(
            pattern: .xx,
            role: .responder,
            staticKey: HudNoise.generateKeyPair(),
            prologue: bytes("another-protocol/v1")
        )

        let messageOne = try initiator.writeMessage()
        _ = try responder.readMessage(messageOne)
        let messageTwo = try responder.writeMessage()
        let mismatchError = capturedNoiseError {
            try initiator.readMessage(messageTwo)
        }
        #expect(mismatchError == .decryptionFailed("authentication failed"))
        #expect(throws: HudNoiseError.handshakeFailed) {
            try initiator.readMessage(messageTwo)
        }
    }

    @Test("invalid configurations and oversized plaintext throw")
    func validationAndPlaintextCeiling() async throws {
        let initiatorKey = HudNoise.generateKeyPair()
        #expect(throws: HudNoiseError.invalidConfiguration(
            "Noise IK initiators require the responder's static public key"
        )) {
            _ = try HudNoiseHandshake(
                pattern: .ik,
                role: .initiator,
                staticKey: initiatorKey
            )
        }
        #expect(throws: HudNoiseError.invalidConfiguration(
            "Only Noise IK initiators accept a preconfigured remote static key"
        )) {
            _ = try HudNoiseHandshake(
                pattern: .xx,
                role: .initiator,
                staticKey: initiatorKey,
                remoteStaticKey: Data(repeating: 7, count: 32)
            )
        }

        let anotherKey = HudNoise.generateKeyPair()
        #expect(throws: HudNoiseError.invalidKey(
            "X25519 public and private keys do not match"
        )) {
            _ = try HudNoiseKeyPair(
                publicKey: initiatorKey.publicKey,
                privateKey: anotherKey.privateKey
            )
        }

        let sessions = try completeXX()
        let oversized = Data(repeating: 0x61, count: HudNoise.maximumPlaintextLength + 1)
        let sizeError = await capturedNoiseError {
            try await sessions.initiator.encrypt(oversized)
        }
        #expect(
            sizeError == .plaintextTooLarge(
                maximum: HudNoise.maximumPlaintextLength,
                actual: oversized.count
            )
        )
        #expect(await sessions.initiator.sendNonce == 0)
    }

    @Test("truncated handshake input fails closed")
    func truncatedHandshake() throws {
        let responder = try HudNoiseHandshake(
            pattern: .xx,
            role: .responder,
            staticKey: HudNoise.generateKeyPair()
        )

        #expect(throws: HudNoiseError.messageTooShort) {
            try responder.readMessage(Data(repeating: 0, count: 31))
        }
        #expect(throws: HudNoiseError.handshakeFailed) {
            try responder.readMessage(Data(repeating: 0, count: 32))
        }
    }

    private func completeXX(prologue: Data = Data()) throws -> Sessions {
        let initiator = try HudNoiseHandshake(
            pattern: .xx,
            role: .initiator,
            staticKey: HudNoise.generateKeyPair(),
            prologue: prologue
        )
        let responder = try HudNoiseHandshake(
            pattern: .xx,
            role: .responder,
            staticKey: HudNoise.generateKeyPair(),
            prologue: prologue
        )

        _ = try responder.readMessage(initiator.writeMessage())
        _ = try initiator.readMessage(responder.writeMessage())
        _ = try responder.readMessage(initiator.writeMessage())
        return Sessions(
            initiator: try initiator.finalize(),
            responder: try responder.finalize()
        )
    }

    private func bytes(_ value: String) -> Data {
        Data(value.utf8)
    }

    private func hex(_ value: String) throws -> Data {
        let compact = value.filter { !$0.isWhitespace }
        #expect(compact.count.isMultiple(of: 2))
        var output = Data(capacity: compact.count / 2)
        var index = compact.startIndex
        while index < compact.endIndex {
            let nextIndex = compact.index(index, offsetBy: 2)
            let byte = try #require(UInt8(compact[index..<nextIndex], radix: 16))
            output.append(byte)
            index = nextIndex
        }
        return output
    }

    private func capturedNoiseError<T>(
        _ operation: () throws -> T
    ) -> HudNoiseError? {
        do {
            _ = try operation()
            Issue.record("Expected a HudNoiseError")
            return nil
        } catch let error as HudNoiseError {
            return error
        } catch {
            Issue.record("Expected HudNoiseError, got \(error)")
            return nil
        }
    }

    private func capturedNoiseError<T>(
        _ operation: () async throws -> T
    ) async -> HudNoiseError? {
        do {
            _ = try await operation()
            Issue.record("Expected a HudNoiseError")
            return nil
        } catch let error as HudNoiseError {
            return error
        } catch {
            Issue.record("Expected HudNoiseError, got \(error)")
            return nil
        }
    }
}

private struct Sessions {
    let initiator: HudNoiseSession
    let responder: HudNoiseSession
}
