import Foundation
@testable import Pulpe
import Testing

/// The payloads below are copied verbatim from the local backend: Postgres
/// serializes `timestamptz` with a `+00:00` offset and six fractional digits,
/// which is what the decoder actually has to swallow.
@Suite("MCPConnectionsService contract", .serialized)
struct MCPConnectionsServiceTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    @Test
    func getAll_decodesBothModesFromTheRealPayload() async throws {
        let recorder = MCPRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            let json = """
            {
              "success": true,
              "data": [
                {
                  "id": "d71b6e6a-6b8c-42bf-b164-b41b981b2670",
                  "clientName": "Claude",
                  "mode": "read",
                  "authorizedAt": "2026-08-23T15:03:14.542+00:00"
                },
                {
                  "id": "a542c4f5-9676-4ff2-af60-ca65e03dd9ca",
                  "clientName": "ChatGPT",
                  "mode": "read_write",
                  "authorizedAt": "2026-08-23T15:03:14.064+00:00"
                }
              ]
            }
            """
            return (makeHTTPResponse(for: request, statusCode: 200), Data(json.utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let connections = try await MCPConnectionsService(apiClient: makeAPIClient()).getAll()

        #expect(recorder.method == "GET")
        #expect(recorder.path == "/mcp/connections")
        #expect(connections.map(\.mode) == [.read, .readWrite])
        #expect(connections.map(\.clientName) == ["Claude", "ChatGPT"])
        #expect(connections.first?.authorizedAt == Date(timeIntervalSince1970: 1_787_497_394.542))
    }

    @Test
    func getActivity_sendsTheLimit_andDecodesMicrosecondTimestamps() async throws {
        let recorder = MCPRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            let json = """
            {
              "success": true,
              "data": [{
                "tool": "add_movement",
                "outcome": "ok",
                "createdAt": "2026-08-23T15:03:14.421934+00:00"
              }]
            }
            """
            return (makeHTTPResponse(for: request, statusCode: 200), Data(json.utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let activity = try await MCPConnectionsService(apiClient: makeAPIClient())
            .getActivity(connectionId: "conn-1", limit: 50)

        #expect(recorder.method == "GET")
        #expect(recorder.path == "/mcp/connections/conn-1/activity")
        #expect(recorder.query == "limit=50")
        let entry = try #require(activity.first)
        #expect(entry.tool == "add_movement")
        #expect(entry.outcome == .ok)
        // The decoder keeps milliseconds and drops what Postgres adds beyond them.
        // Harmless here — the journal shows an hour and a minute — but it means a
        // microsecond timestamp must never be compared for equality.
        let drift = abs(entry.createdAt.timeIntervalSince1970 - 1_787_497_394.421934)
        #expect(drift < 0.001)
    }

    @Test
    func revoke_deletesTheConnection() async throws {
        let recorder = MCPRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 204), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        try await MCPConnectionsService(apiClient: makeAPIClient()).revoke(connectionId: "conn-1")

        #expect(recorder.method == "DELETE")
        #expect(recorder.path == "/mcp/connections/conn-1")
    }

    private func makeAPIClient() -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let session = URLSession(configuration: configuration)
        return APIClient(
            session: session,
            baseURL: baseURL,
            authTokenProvider: { "test-token" },
            clientKeyProvider: { nil }
        )
    }
}

private final class MCPRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedPath: String?
    private var storedMethod: String?
    private var storedQuery: String?

    func record(_ request: URLRequest) {
        lock.withLock {
            storedPath = request.url?.path
            storedMethod = request.httpMethod
            storedQuery = request.url?.query
        }
    }

    var path: String? { lock.withLock { storedPath } }
    var method: String? { lock.withLock { storedMethod } }
    var query: String? { lock.withLock { storedQuery } }
}
