import Foundation

/// URLProtocol that routes `https://pulpe.test/*` requests to a test-supplied handler.
/// Register via `URLSessionConfiguration.protocolClasses = [InterceptingURLProtocol.self]`
/// then assign `InterceptingURLProtocol.requestHandler`. Always `defer { requestHandler = nil }`.
final class InterceptingURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var requestHandler:
        (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

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

/// Builds an `HTTPURLResponse` for a test request. Falls back to a placeholder URL if the
/// request has none (avoids force-unwrap while keeping callsites terse).
func makeHTTPResponse(for request: URLRequest, statusCode: Int) -> HTTPURLResponse {
    let url = request.url
        ?? URL(string: "https://pulpe.test/fallback")
        ?? URL(fileURLWithPath: "/")
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
