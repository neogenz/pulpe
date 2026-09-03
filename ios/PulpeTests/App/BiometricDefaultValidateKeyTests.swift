import Foundation
@testable import Pulpe
import Testing

/// PUL-280: `BiometricManager.defaultValidateKey` must be offline-tolerant.
///
/// `encryptionAPI.validateKey` routes through `APIClient`, which wraps every `URLError`
/// into `APIError.networkError`. The old `catch is URLError` therefore never matched on a
/// real offline failure → the key was misclassified as "stale" → forced PIN + wiped client
/// key + disabled biometric. These tests drive the REAL closure end-to-end through the
/// wrapping path (real APIClient + EncryptionAPI over InterceptingURLProtocol) so the bug
/// (and the security constraint) are exercised exactly as in production.
@Suite(.serialized)
@MainActor
struct BiometricDefaultValidateKeyTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")
    private let clientKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    private func makeValidateClosure() -> @Sendable (String) async -> Bool {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let apiClient = APIClient(
            session: session,
            baseURL: baseURL,
            authTokenProvider: { "test-auth-token" },
            clientKeyProvider: { self.clientKey }
        )
        let encryptionAPI = EncryptionAPI(apiClient: apiClient)
        return BiometricManager.defaultValidateKey(encryptionAPI)
    }

    /// RED before the fix (the wrapped `APIError.networkError` falls into `catch { return false }`).
    /// GREEN after the fix (offline → tolerate so the already-locally-passed Face ID unlock proceeds).
    @Test("offline (wrapped networkError) tolerates so biometric unlock proceeds")
    func defaultValidateKey_offlineNetworkError_returnsTrue() async {
        InterceptingURLProtocol.requestHandler = { _ in
            // Not in APIClient.isTransientError → no retry loop → wrapped to APIError.networkError.
            throw URLError(.notConnectedToInternet)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let validate = makeValidateClosure()
        let result = await validate(clientKey)

        #expect(result == true, "Offline: server unreachable, must NOT force PIN / wipe the client key")
    }

    /// GREEN before AND after the fix — locks the security constraint: a genuine bad-key
    /// verdict must never be tolerated.
    @Test("genuine bad-key verdict (clientKeyInvalid) rejects so PIN is required")
    func defaultValidateKey_clientKeyInvalid_returnsFalse() async {
        InterceptingURLProtocol.requestHandler = { request in
            let body = Data(#"{"success":false,"code":"ERR_ENCRYPTION_KEY_CHECK_FAILED","message":"invalid"}"#.utf8)
            return (makeHTTPResponse(for: request, statusCode: 400), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let validate = makeValidateClosure()
        let result = await validate(clientKey)

        #expect(result == false, "A genuinely rotated/revoked key must fall through to PIN, never tolerated")
    }

    /// RED before the PUL-337 fix: the maintenance 503 fell into `catch { return false }`,
    /// so every maintenance window read as a stale key.
    @Test("maintenance 503 tolerates: the server never looked at the key")
    func defaultValidateKey_maintenance_returnsTrue() async {
        InterceptingURLProtocol.requestHandler = { request in
            let body = Data(#"{"success":false,"code":"MAINTENANCE","message":"maintenance"}"#.utf8)
            return (makeHTTPResponse(for: request, statusCode: 503), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let validate = makeValidateClosure()
        let result = await validate(clientKey)

        #expect(result == true, "Maintenance means unavailable, never a verdict on the key")
    }

    /// The damage the verdict caused: `attemptUnlock` wiped the client key and turned Face ID
    /// off for every biometric user, on every maintenance window.
    @Test("attemptUnlock under maintenance leaves Face ID enrolled")
    func attemptUnlock_maintenance_keepsBiometricEnabled() async {
        InterceptingURLProtocol.requestHandler = { request in
            let body = Data(#"{"success":false,"code":"MAINTENANCE","message":"maintenance"}"#.utf8)
            return (makeHTTPResponse(for: request, statusCode: 503), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let manager = BiometricManager(
            preferenceStore: AppStateTestFactory.biometricEnabledStore(),
            clientKeyManager: .shared,
            capability: { true },
            authenticate: {},
            resolveKey: { self.clientKey },
            validateKey: makeValidateClosure()
        )
        manager.hydrate(true)

        let unlocked = await manager.attemptUnlock()

        #expect(unlocked == true)
        #expect(manager.isEnabled == true, "handleStaleKey must not run: the enrollment survives")
    }
}
