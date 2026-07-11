import Foundation
@testable import Pulpe
import Supabase
import Testing

@Suite("AuthService biometric resync retry")
struct AuthServiceBiometricResyncTests {
    @Test("Transient session failure preserves the deferred biometric resync")
    func transientSessionFailure_preservesPendingBiometricResync() async throws {
        let storage = InMemoryAuthStorage()
        let storageKey = "session-\(UUID().uuidString)"

        try storage.store(
            key: storageKey,
            value: JSONEncoder().encode(Self.expiredSession())
        )
        let sut = AuthService(
            testingSupabase: Self.makeClient(storage: storage, storageKey: storageKey),
            storage: storage,
            pendingBiometricResync: true
        )

        await sut.retryPendingBiometricResync()

        #expect(await sut.isBiometricResyncPendingForTesting)
    }

    @Test("Confirmed terminal session failure clears the deferred biometric resync")
    func terminalSessionFailure_clearsPendingBiometricResync() async {
        let storage = InMemoryAuthStorage()
        let storageKey = "session-\(UUID().uuidString)"
        let sut = AuthService(
            testingSupabase: Self.makeClient(storage: storage, storageKey: storageKey),
            storage: storage,
            pendingBiometricResync: true
        )

        await sut.retryPendingBiometricResync()

        #expect(await sut.isBiometricResyncPendingForTesting == false)
    }

    private static func makeClient(
        storage: any AuthLocalStorage,
        storageKey: String
    ) -> SupabaseClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FailingAuthURLProtocol.self]

        return SupabaseClient(
            supabaseURL: URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/"),
            supabaseKey: "test-anon-key",
            options: SupabaseClientOptions(
                auth: .init(storage: storage, storageKey: storageKey),
                global: .init(session: URLSession(configuration: configuration))
            )
        )
    }

    private static func expiredSession() -> Session {
        let now = Date()
        let user = User(
            id: UUID(),
            appMetadata: [:],
            userMetadata: [:],
            aud: "authenticated",
            email: "test@pulpe.app",
            createdAt: now,
            updatedAt: now
        )
        return Session(
            accessToken: "expired-access-token",
            tokenType: "bearer",
            expiresIn: 0,
            expiresAt: now.addingTimeInterval(-60).timeIntervalSince1970,
            refreshToken: "refresh-token",
            user: user
        )
    }
}

private final class FailingAuthURLProtocol: URLProtocol, @unchecked Sendable {
    override static func canInit(with request: URLRequest) -> Bool {
        request.url?.host == "pulpe.test"
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
    }

    override func stopLoading() {}
}

private final class InMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
    private let lock = NSLock()
    private var values: [String: Data] = [:]

    func store(key: String, value: Data) throws {
        lock.lock()
        defer { lock.unlock() }
        values[key] = value
    }

    func retrieve(key: String) throws -> Data? {
        lock.lock()
        defer { lock.unlock() }
        return values[key]
    }

    func remove(key: String) throws {
        lock.lock()
        defer { lock.unlock() }
        values.removeValue(forKey: key)
    }
}
