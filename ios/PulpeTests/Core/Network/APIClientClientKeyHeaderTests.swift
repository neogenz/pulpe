import Foundation
@testable import Pulpe
import Supabase
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
        let requestID = request?.value(forHTTPHeaderField: "X-Request-Id")
        #expect(requestID.flatMap(UUID.init(uuidString:)) != nil)
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
        let requestID = request?.value(forHTTPHeaderField: "X-Request-Id")
        #expect(requestID.flatMap(UUID.init(uuidString:)) != nil)
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

    @Test func networkErrorDiagnostic_omitsRawMessageAndKeepsStableContext() {
        let sentinel = "PRIVATE_NETWORK_ERROR_SENTINEL"
        let diagnostic = APIClient.networkErrorDiagnostic(
            SentinelNetworkError(message: sentinel),
            requestID: "request-123"
        )
        let urlDiagnostic = APIClient.networkErrorDiagnostic(
            URLError(.timedOut),
            requestID: "request-456"
        )

        #expect(!diagnostic.contains(sentinel))
        #expect(diagnostic.contains("requestId=request-123"))
        #expect(diagnostic.contains("SentinelNetworkError"))
        #expect(urlDiagnostic.contains("requestId=request-456"))
        #expect(urlDiagnostic.contains(String(URLError.Code.timedOut.rawValue)))
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

    @Test func requestVoid_unauthorized_forcesRefreshThenRetriesWithFreshToken() async throws {
        let recorder = RequestRecorder()
        let invalidationCalled = AtomicFlag()
        let expiredToken = "expired-token"
        let refreshedToken = "refreshed-token"

        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            if request.value(forHTTPHeaderField: "Authorization") == "Bearer \(expiredToken)" {
                return (makeHTTPResponse(for: request, statusCode: 401), Data())
            }
            return (makeHTTPResponse(for: request, statusCode: 204), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: expiredToken,
            clientKey: clientKey,
            authTokenProvider: { expiredToken },
            forceRefreshAccessToken: { refreshedToken },
            invalidateSession: { invalidationCalled.set() }
        )

        try await sut.requestVoid(.validateSession)

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

    @Test func request_unauthorized_refreshRejectedWith4xx_invalidatesSessionAndThrowsUnauthorized() async {
        let invalidationCalled = AtomicFlag()

        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 401), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: "expired-token",
            clientKey: clientKey,
            forceRefreshAccessToken: { throw Self.authAPIError(statusCode: 400) },
            invalidateSession: { invalidationCalled.set() }
        )

        do {
            let _: UserPayload = try await sut.request(.userProfile)
            Issue.record("Expected the request to fail")
        } catch let error as APIError {
            guard case .unauthorized = error else {
                Issue.record("Expected APIError.unauthorized, got \(error)")
                return
            }
        } catch {
            Issue.record("Expected APIError, got \(error)")
        }
        #expect(invalidationCalled.value == true)
    }

    @Test func request_unauthorized_refreshURLError_keepsSessionAndThrowsNetworkError() async {
        let invalidationCalled = AtomicFlag()

        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 401), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: "expired-token",
            clientKey: clientKey,
            forceRefreshAccessToken: { throw URLError(.notConnectedToInternet) },
            invalidateSession: { invalidationCalled.set() }
        )

        await expectNetworkError(from: sut)
        #expect(invalidationCalled.value == false)
    }

    @Test func request_unauthorized_refreshAuthServer5xx_keepsSessionAndThrowsNetworkError() async {
        let invalidationCalled = AtomicFlag()

        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 401), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: "expired-token",
            clientKey: clientKey,
            forceRefreshAccessToken: { throw Self.authAPIError(statusCode: 503) },
            invalidateSession: { invalidationCalled.set() }
        )

        await expectNetworkError(from: sut)
        #expect(invalidationCalled.value == false)
    }

    @Test func request_unauthorized_refreshUnconfirmedSessionMissing_keepsSessionAndThrowsNetworkError() async {
        let invalidationCalled = AtomicFlag()

        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 401), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(
            token: "expired-token",
            clientKey: clientKey,
            forceRefreshAccessToken: { throw AuthError.sessionMissing },
            invalidateSession: { invalidationCalled.set() }
        )

        await expectNetworkError(from: sut)
        #expect(invalidationCalled.value == false)
    }

    private static func authAPIError(statusCode: Int) -> AuthError {
        let url = URL(string: "https://example.supabase.co/auth/v1/token") ?? URL(fileURLWithPath: "/")
        return AuthError.api(
            message: "refresh rejected",
            errorCode: .unknown,
            underlyingData: Data(),
            underlyingResponse: makeHTTPResponse(for: URLRequest(url: url), statusCode: statusCode)
        )
    }

    private func expectNetworkError(from sut: APIClient) async {
        do {
            let _: UserPayload = try await sut.request(.userProfile)
            Issue.record("Expected the request to fail")
        } catch let error as APIError {
            guard case .networkError = error else {
                Issue.record("Expected APIError.networkError, got \(error)")
                return
            }
        } catch {
            Issue.record("Expected APIError, got \(error)")
        }
    }

    @Test func request_successFalsePlanConflictOn2xxStaysServerError() async {
        InterceptingURLProtocol.requestHandler = { request in
            let body = Data(
                #"{"success":false,"code":"ERR_SAVINGS_GOAL_PLAN_CONFLICT","message":"invalid payload"}"#.utf8
            )
            return (makeHTTPResponse(for: request, statusCode: 200), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(token: authToken, clientKey: clientKey)

        do {
            let _: UserPayload = try await sut.request(.userProfile)
            Issue.record("Expected the success:false envelope to fail")
        } catch let error as APIError {
            #expect(error.requiresSavingsGoalPlanRefresh == false)
            guard case .serverError = error else {
                Issue.record("Expected a server error for a 2xx envelope")
                return
            }
        } catch {
            Issue.record("Expected APIError, got \(error)")
        }
    }

    @Test func diagnosticPath_redactsResourceIdentifiers() {
        let id = "52d65f63-c7c9-4fcb-bf20-b8080fed6288"

        #expect(APIClient.diagnosticPath(for: .budgetDetails(id: id)) == "/budgets/:id/details")
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

private struct SentinelNetworkError: LocalizedError {
    let message: String

    var errorDescription: String? { message }
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
