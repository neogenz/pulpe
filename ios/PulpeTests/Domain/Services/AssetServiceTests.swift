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

    /// The contract data set (PUL-379): « Compte courant » worth 9 420, its last entry 5 000.
    static let compteCourantHistory = """
    {"asset":{"id":"a1","categoryId":"c1","name":"Compte courant","currency":"CHF","direction":"own",
    "inPulpe":false,"archivedAt":null,"latestValue":9420,"recordedValue":5000,
    "latestRecordedAt":"2026-11-01T10:00:00.000Z","convertedValue":9420,"suggestion":null},
    "entries":[
    {"type":"movement","id":"11111111-1111-4111-8111-111111111111","at":"2026-11-10T10:00:00.000Z",
    "name":"Salaire","effect":6000,"supersededAt":null},
    {"type":"movement","id":"22222222-2222-4222-8222-222222222222","at":"2026-11-05T10:00:00.000Z",
    "name":"Restaurant","effect":-80,"supersededAt":null},
    {"type":"movement","id":"33333333-3333-4333-8333-333333333333","at":"2026-11-03T10:00:00.000Z",
    "name":"Loyer","effect":-1500,"supersededAt":null},
    {"type":"snapshot","id":"44444444-4444-4444-8444-444444444444","at":"2026-11-01T10:00:00.000Z","value":5000},
    {"type":"movement","id":"55555555-5555-4555-8555-555555555555","at":"2026-10-28T10:00:00.000Z",
    "name":"Assurance","effect":-300,"supersededAt":"2026-11-01T10:00:00.000Z"},
    {"type":"snapshot","id":"66666666-6666-4666-8666-666666666666","at":"2026-10-01T10:00:00.000Z","value":4800}
    ],
    "nextCursor":null}
    """

    @Test
    func getHistory_decodesTheContractDataSet_newestFirst() async throws {
        var history: AssetHistory?
        let seen = try await capture(data: Self.compteCourantHistory) {
            history = try await $0.getHistory(id: "a1", cursor: nil)
        }
        let page = try #require(history)

        #expect(seen.method == "GET")
        #expect(seen.path == "/assets/a1/history")
        #expect(seen.query == nil)
        #expect(page.asset.latestValue == 9420)
        #expect(page.asset.recordedValue == 5000)
        #expect(page.nextCursor == nil)
        let titles = page.entries.map { entry -> String in
            switch entry.kind {
            case .snapshot(let value): "\(value)"
            case let .movement(name, _, _): name
            }
        }
        #expect(titles == ["Salaire", "Restaurant", "Loyer", "5000", "Assurance", "4800"])
        let effects = page.entries.compactMap { entry -> Decimal? in
            if case let .movement(_, effect, _) = entry.kind { return effect }
            return nil
        }
        #expect(effects == [6000, -80, -1500, -300])
        // Dates carry milliseconds: the second is kept exactly.
        #expect(page.entries[3].at == ISO8601DateFormatter().date(from: "2026-11-01T10:00:00Z"))
        guard case let .movement(_, _, supersededAt) = page.entries[4].kind else {
            Issue.record("Assurance should be a movement")
            return
        }
        #expect(supersededAt == page.entries[3].at)
        // CA5: what counts in the value is the value minus the last entry.
        let counted = page.entries.reduce(Decimal(0)) { sum, entry in
            if case let .movement(_, effect?, nil) = entry.kind { return sum + effect }
            return sum
        }
        #expect(counted == page.asset.latestValue - page.asset.recordedValue)
    }

    @Test
    func getHistory_sendsTheCursor_andDecodesAMissingRate() async throws {
        let payload = """
        {"asset":\(Self.historyAsset),"entries":[{"type":"movement","id":"77777777-7777-4777-8777-777777777777",
        "at":"2026-11-04T08:30:00.123Z","name":"Courses","effect":null,"supersededAt":null}],"nextCursor":"1.1.x"}
        """
        var history: AssetHistory?
        let seen = try await capture(data: payload) {
            history = try await $0.getHistory(id: "a1", cursor: "1793782800000.0.abc")
        }
        let page = try #require(history)

        #expect(seen.query == "cursor=1793782800000.0.abc")
        #expect(page.nextCursor == "1.1.x")
        #expect(page.entries.first?.kind == .movement(name: "Courses", effect: nil, supersededAt: nil))
    }

    /// PUL-380: the projection rides at the root of the page; `null` and an older server read as `nil`.
    @Test(arguments: [
        (#","monthEndProjection":{"month":11,"year":2026,"value":13620}"#, AssetMonthEndProjection?.some(
            AssetMonthEndProjection(month: 11, year: 2026, value: 13620)
        )),
        (#","monthEndProjection":null"#, nil),
        ("", nil),
    ])
    func getHistory_decodesTheMonthEndProjection(field: String, expected: AssetMonthEndProjection?) async throws {
        let payload = #"{"asset":\#(Self.historyAsset),"entries":[],"nextCursor":null\#(field)}"#
        var history: AssetHistory?
        _ = try await capture(data: payload) { history = try await $0.getHistory(id: "a1", cursor: nil) }

        #expect(try #require(history).monthEndProjection == expected)
    }

    private static let historyAsset = """
    {"id":"a1","categoryId":"c1","name":"Compte courant","currency":"EUR","direction":"own","inPulpe":false,
    "archivedAt":null,"latestValue":10,"recordedValue":10,"latestRecordedAt":"2026-11-01T10:00:00.000Z",
    "convertedValue":null}
    """

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
    private var storedQuery: String?
    private var storedMethod: String?
    private var storedBody: Data?

    func record(_ urlRequest: URLRequest) {
        let body = urlRequest.httpBody ?? urlRequest.httpBodyStream.map(Self.drain)
        lock.withLock {
            storedPath = urlRequest.url?.path
            storedQuery = urlRequest.url?.query
            storedMethod = urlRequest.httpMethod
            storedBody = body
        }
    }

    var path: String? { lock.withLock { storedPath } }
    var query: String? { lock.withLock { storedQuery } }
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
