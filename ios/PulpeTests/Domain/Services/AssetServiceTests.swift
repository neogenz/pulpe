import Foundation
@testable import Pulpe
import Testing

@Suite("AssetService contract", .serialized)
struct AssetServiceTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    private static let record = """
    {"id":"a1","categoryId":"c1","name":"UBS","currency":"CHF","direction":"own","inPulpe":false,"archivedAt":null}
    """
    private static let category = #"{"id":"c1","name":"Comptes"}"#

    /// Runs `call` against a canned `data` payload and returns what the server saw.
    private func capture(
        data: String,
        _ call: (AssetService) async throws -> Void
    ) async throws -> AssetRequestRecorder {
        let recorder = AssetRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (
                makeHTTPResponse(for: request, statusCode: 200),
                Data(#"{"success":true,"data":\#(data)}"#.utf8)
            )
        }
        defer { InterceptingURLProtocol.requestHandler = nil }
        try await call(AssetService(apiClient: makeAPIClient()))
        return recorder
    }

    @Test
    func getNetWorth_getsAssets() async throws {
        let totals = #"{"baseCurrency":"CHF","gross":0,"debts":0,"net":0,"incomplete":false}"#
        let empty = #"{"totals":\#(totals),"categories":[],"assets":[]}"#
        let seen = try await capture(data: empty) { _ = try await $0.getNetWorth() }

        #expect(seen.method == "GET")
        #expect(seen.path == "/assets")
    }

    @Test
    func create_postsAsset() async throws {
        let payload = AssetCreate(
            name: "UBS", categoryId: "c1", currency: .chf, direction: .own, inPulpe: false, value: 10
        )
        let seen = try await capture(data: Self.record) { _ = try await $0.create(payload) }

        #expect(seen.method == "POST")
        #expect(seen.path == "/assets")
        #expect(seen.json["name"] as? String == "UBS")
        #expect(seen.json["value"] as? Int == 10)
    }

    @Test
    func update_patchesOnlyTheGivenKey() async throws {
        let seen = try await capture(data: Self.record) {
            _ = try await $0.update(id: "a1", AssetUpdate(archived: true))
        }

        #expect(seen.method == "PATCH")
        #expect(seen.path == "/assets/a1")
        #expect(seen.body.flatMap { String(data: $0, encoding: .utf8) } == #"{"archived":true}"#)
    }

    @Test
    func delete_deletesAsset() async throws {
        let seen = try await capture(data: "null") { try await $0.delete(id: "a1") }

        #expect(seen.method == "DELETE")
        #expect(seen.path == "/assets/a1")
    }

    @Test
    func recordSnapshots_postsItems() async throws {
        let payload = AssetSnapshotsCreate(items: [AssetSnapshotItem(assetId: "a1", value: 5)])
        let seen = try await capture(data: #"{"recordedAt":"2026-11-01T10:00:00Z"}"#) {
            _ = try await $0.recordSnapshots(payload)
        }

        #expect(seen.method == "POST")
        #expect(seen.path == "/assets/snapshots")
        #expect((seen.json["items"] as? [[String: Any]])?.first?["assetId"] as? String == "a1")
    }

    @Test
    func dismissSuggestion_postsWithoutBody() async throws {
        let seen = try await capture(data: Self.record) { _ = try await $0.dismissSuggestion(id: "a1") }

        #expect(seen.method == "POST")
        #expect(seen.path == "/assets/a1/dismiss-suggestion")
    }

    @Test
    func createCategory_postsName() async throws {
        let seen = try await capture(data: Self.category) {
            _ = try await $0.createCategory(AssetCategoryWrite(name: "Comptes"))
        }

        #expect(seen.method == "POST")
        #expect(seen.path == "/asset-categories")
        #expect(seen.json["name"] as? String == "Comptes")
    }

    @Test
    func renameCategory_patchesName() async throws {
        let seen = try await capture(data: Self.category) {
            _ = try await $0.renameCategory(id: "c1", AssetCategoryWrite(name: "Épargne"))
        }

        #expect(seen.method == "PATCH")
        #expect(seen.path == "/asset-categories/c1")
        #expect(seen.json["name"] as? String == "Épargne")
    }

    private func makeAPIClient() -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        return APIClient(
            session: URLSession(configuration: configuration),
            baseURL: baseURL,
            authTokenProvider: { "test-token" },
            clientKeyProvider: { nil }
        )
    }
}

private final class AssetRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedPath: String?
    private var storedMethod: String?
    private var storedBody: Data?

    func record(_ urlRequest: URLRequest) {
        let body = urlRequest.httpBody ?? urlRequest.httpBodyStream.map(Self.drain)
        lock.withLock {
            storedPath = urlRequest.url?.path
            storedMethod = urlRequest.httpMethod
            storedBody = body
        }
    }

    var path: String? { lock.withLock { storedPath } }
    var method: String? { lock.withLock { storedMethod } }
    var body: Data? { lock.withLock { storedBody } }

    var json: [String: Any] {
        guard let body, let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else { return [:] }
        return object
    }

    private static func drain(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
