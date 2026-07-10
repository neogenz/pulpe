import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
struct APIClientClientKeyHeaderTests {
    private let baseURL: URL
    private let authToken = "test-auth-token"
    private let clientKey: String

    init() {
        self.baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")
        self.clientKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }

    @Test func request_includesClientKeyAndAuthorizationHeaders() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            let body = Data(#"{"id":"user-1"}"#.utf8)
            return (makeHTTPResponse(for: request, statusCode: 200), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(token: authToken, clientKey: clientKey)
        let _: UserPayload = try await sut.request(.userProfile)

        let request = recorder.request
        #expect(request?.value(forHTTPHeaderField: "Authorization") == "Bearer \(authToken)")
        #expect(request?.value(forHTTPHeaderField: "X-Client-Key") == clientKey)
    }

    @Test func requestVoid_includesClientKeyAndAuthorizationHeaders() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 204), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(token: authToken, clientKey: clientKey)
        try await sut.requestVoid(.validateSession)

        let request = recorder.request
        #expect(request?.value(forHTTPHeaderField: "Authorization") == "Bearer \(authToken)")
        #expect(request?.value(forHTTPHeaderField: "X-Client-Key") == clientKey)
    }

    @Test func request_omitsClientKeyHeaderWhenUnavailable() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            let body = Data(#"{"id":"user-2"}"#.utf8)
            return (makeHTTPResponse(for: request, statusCode: 200), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(token: authToken, clientKey: nil)
        let _: UserPayload = try await sut.request(.userProfile)

        let request = recorder.request
        #expect(request?.value(forHTTPHeaderField: "Authorization") == "Bearer \(authToken)")
        #expect(request?.value(forHTTPHeaderField: "X-Client-Key") == nil)
    }

    @Test func request_unauthorized_forcesRefreshThenRetriesWithFreshToken() async throws {
        let recorder = RequestRecorder()
        let invalidationCalled = AtomicFlag()
        let expiredToken = "expired-token"
        let refreshedToken = "refreshed-token"

        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            if request.value(forHTTPHeaderField: "Authorization") == "Bearer \(expiredToken)" {
                return (makeHTTPResponse(for: request, statusCode: 401), Data())
            }
            let body = Data(#"{"id":"user-refreshed"}"#.utf8)
            return (makeHTTPResponse(for: request, statusCode: 200), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: expiredToken,
            clientKey: clientKey,
            authTokenProvider: { expiredToken },
            forceRefreshAccessToken: { refreshedToken },
            invalidateSession: { invalidationCalled.set() }
        )

        let payload: UserPayload = try await sut.request(.userProfile)

        #expect(payload.id == "user-refreshed")
        #expect(invalidationCalled.value == false)
        #expect(recorder.requests.count == 2)
        let retryAuthorization = recorder.requests.last?.value(forHTTPHeaderField: "Authorization")
        #expect(retryAuthorization == "Bearer \(refreshedToken)")
    }

    @Test func request_unauthorized_refreshThrows_doesNotInvalidateSession() async {
        let invalidationCalled = AtomicFlag()

        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 401), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: "expired-token",
            clientKey: clientKey,
            forceRefreshAccessToken: {
                throw APIError.serverError(message: "Service unavailable (503)")
            },
            invalidateSession: { invalidationCalled.set() }
        )

        await #expect(throws: APIError.self) {
            let _: UserPayload = try await sut.request(.userProfile)
        }

        #expect(invalidationCalled.value == false)
    }

    private func makeSUT(
        token: String?,
        clientKey: String?,
        authTokenProvider: (@Sendable () async -> String?)? = nil,
        forceRefreshAccessToken: (@Sendable () async throws -> String?)? = nil,
        invalidateSession: (@Sendable () async -> Void)? = nil
    ) -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let session = URLSession(configuration: configuration)

        return APIClient(
            session: session,
            baseURL: baseURL,
            authTokenProvider: authTokenProvider ?? { token },
            clientKeyProvider: { clientKey },
            forceRefreshAccessToken: forceRefreshAccessToken,
            invalidateSession: invalidateSession
        )
    }
}

private struct UserPayload: Decodable {
    let id: String
}

private final class RequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [URLRequest] = []

    func record(_ request: URLRequest) {
        lock.lock()
        storage.append(request)
        lock.unlock()
    }

    var request: URLRequest? {
        lock.lock()
        defer { lock.unlock() }
        return storage.last
    }

    var requests: [URLRequest] {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }
}
