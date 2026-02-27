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
            return (Self.httpResponse(for: request, statusCode: 200), body)
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
            return (Self.httpResponse(for: request, statusCode: 204), Data())
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
            return (Self.httpResponse(for: request, statusCode: 200), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT(token: authToken, clientKey: nil)
        let _: UserPayload = try await sut.request(.userProfile)

        let request = recorder.request
        #expect(request?.value(forHTTPHeaderField: "Authorization") == "Bearer \(authToken)")
        #expect(request?.value(forHTTPHeaderField: "X-Client-Key") == nil)
    }

    private func makeSUT(token: String?, clientKey: String?) -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let session = URLSession(configuration: configuration)

        return APIClient(
            session: session,
            baseURL: baseURL,
            authTokenProvider: { token },
            clientKeyProvider: { clientKey }
        )
    }

    private static func httpResponse(for request: URLRequest, statusCode: Int) -> HTTPURLResponse {
        let url = request.url ?? URL(string: "https://pulpe.test/fallback") ?? URL(fileURLWithPath: "/")
        guard let response = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        ) else {
            fatalError("Failed to create HTTPURLResponse")
        }
        return response
    }
}

private struct UserPayload: Decodable {
    let id: String
}

private final class InterceptingURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override static func canInit(with request: URLRequest) -> Bool {
        request.url?.host == "pulpe.test"
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private final class RequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: URLRequest?

    func record(_ request: URLRequest) {
        lock.lock()
        storage = request
        lock.unlock()
    }

    var request: URLRequest? {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }
}
