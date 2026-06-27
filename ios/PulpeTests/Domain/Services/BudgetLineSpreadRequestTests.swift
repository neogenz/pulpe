import Foundation
@testable import Pulpe
import Testing

/// PUL-17 Lot A — the `POST /budget-lines/spread` contract as exercised by
/// `BudgetLineService.createSpread`. The service is a thin pass-through to
/// `APIClient.request(.budgetLinesSpread, body:, method: .post)`, so these tests
/// drive a test-configured `APIClient` over the SAME encode/decode path:
///   - the request body carries a single `perMonthAmount` + one `months` ref
///     `{year, month}` per selected month (ascending), which the server replicates
///     into tranches,
///   - `kind` is expense|saving (income is never spread — model-level invariant),
///   - a single frozen `exchangeRate` + single `perMonthOriginalAmount` cover the
///     whole spread; FX keys are absent for a same-currency spread,
///   - the `{ spreadGroupId, lines, createdBudgets, skippedMonths }` response decodes.
@Suite("BudgetLineService.createSpread contract", .serialized)
struct BudgetLineSpreadRequestTests {
    private let baseURL: URL

    init() {
        self.baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")
    }

    // MARK: - Request body: per-month amount + one month ref per selected month

    @Test
    func createSpread_postsPerMonthAmountAndOneRefPerSelectedMonth() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Self.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let calculator = await SpreadCalculator(anchorMonth: 11, anchorYear: 2026)
        await calculator.setEnd(SpreadMonth(year: 2027, month: 1)) // Nov, Dec, Jan
        let months = await calculator.selectedMonths.map {
            SpreadMonthRef(year: $0.year, month: $0.month)
        }
        let body = BudgetLineSpreadCreate(
            name: "Impôts", kind: .expense, mode: .perMonth, months: months, perMonthAmount: 80
        )

        let apiClient = makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let request = try #require(recorder.request)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/budget-lines/spread")

        let decoded = try #require(recorder.decodedBody)
        #expect(decoded.kind == "expense")
        #expect(decoded.name == "Impôts")
        #expect(decoded.mode == "perMonth")
        #expect(decoded.perMonthAmount == 80)
        // One month ref per selected month, ascending.
        #expect(decoded.months.map { TranchePair($0.year, $0.month) } == [
            TranchePair(2026, 11), TranchePair(2026, 12), TranchePair(2027, 1),
        ])
    }

    // MARK: - kind: expense | saving (income excluded)

    @Test("kind is faithfully serialized for the two spreadable kinds", arguments: [
        (TransactionKind.expense, "expense"),
        (TransactionKind.saving, "saving"),
    ])
    func createSpread_serializesSpreadableKind(kind: TransactionKind, expected: String) async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Self.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Épargne",
            kind: kind,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 200
        )

        let apiClient = makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let decoded = try #require(recorder.decodedBody)
        #expect(decoded.kind == expected)
    }

    // MARK: - Single frozen exchangeRate + perMonthOriginalAmount for the whole spread

    @Test
    func createSpread_sendsOneFrozenExchangeRateAndOnePerMonthOriginalAmount() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Self.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        // Full-FX spread: perMonthAmount is the converted (target) figure,
        // perMonthOriginalAmount the input — both single, replicated server-side.
        let calculator = await SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        await calculator.setEnd(SpreadMonth(year: 2026, month: 3)) // 3 months
        let months = await calculator.selectedMonths.map {
            SpreadMonthRef(year: $0.year, month: $0.month)
        }
        let body = BudgetLineSpreadCreate(
            name: "Assurance",
            kind: .expense,
            mode: .perMonth,
            months: months,
            perMonthAmount: 93,
            perMonthOriginalAmount: 100,
            originalCurrency: .eur,
            targetCurrency: .chf,
            exchangeRate: Decimal(string: "0.93")
        )

        let apiClient = makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let decoded = try #require(recorder.decodedBody)
        // Exactly ONE exchangeRate + ONE perMonthOriginalAmount at request level (FX figé).
        #expect(decoded.exchangeRate == Decimal(string: "0.93"))
        #expect(decoded.perMonthOriginalAmount == 100)
        #expect(decoded.perMonthAmount == 93)
        #expect(decoded.originalCurrency == "EUR")
        #expect(decoded.targetCurrency == "CHF")
        #expect(decoded.months.count == 3)
    }

    // MARK: - Total mode: totalAmount serialized, perMonth fields omitted

    @Test
    func createSpread_totalMode_serializesTotalAmountAndOmitsPerMonth() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Self.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Vacances",
            kind: .expense,
            mode: .total,
            months: [
                SpreadMonthRef(year: 2026, month: 6),
                SpreadMonthRef(year: 2026, month: 7),
                SpreadMonthRef(year: 2026, month: 8),
            ],
            totalAmount: 90
        )

        let apiClient = makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let decoded = try #require(recorder.decodedBody)
        #expect(decoded.mode == "total")
        #expect(decoded.totalAmount == 90)
        // Per-month + FX keys are omitted (auto-synth Encodable drops nil).
        #expect(decoded.perMonthAmount == nil)
        #expect(decoded.perMonthOriginalAmount == nil)
        #expect(decoded.totalOriginalAmount == nil)
        #expect(decoded.exchangeRate == nil)
        #expect(decoded.originalCurrency == nil)
        #expect(decoded.targetCurrency == nil)
        #expect(decoded.months.count == 3)
    }

    @Test
    func createSpread_omitsFXFieldsForSameCurrencySpread() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Self.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Loyer ponctuel",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 500
        )

        let apiClient = makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let decoded = try #require(recorder.decodedBody)
        #expect(decoded.exchangeRate == nil)
        #expect(decoded.originalCurrency == nil)
        #expect(decoded.targetCurrency == nil)
        #expect(decoded.perMonthOriginalAmount == nil)
        #expect(decoded.totalAmount == nil)
        #expect(decoded.totalOriginalAmount == nil)
    }

    // MARK: - Response decoding

    @Test
    func createSpread_decodesSpreadResponse() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 200), Self.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Impôts",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 80
        )

        let apiClient = makeAPIClient()
        let response: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        #expect(response.spreadGroupId == Self.fixtureGroupId)
        #expect(response.lines.count == 2)
        #expect(response.lines.allSatisfy { $0.spreadGroupId == Self.fixtureGroupId })
        #expect(response.createdBudgets.count == 1)
        #expect(response.createdBudgets.first?.id == "budget-jul")
        #expect(response.skippedMonths == [SpreadSkippedMonth(month: 8, year: 2026)])
    }

    @Test
    func createSpread_decodesEmptySkippedMonths() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 200), Self.responseDataNoSkips())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Impôts",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 80
        )

        let apiClient = makeAPIClient()
        let response: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        #expect(response.skippedMonths.isEmpty)
        #expect(response.createdBudgets.isEmpty)
        #expect(response.lines.count == 1)
    }

    // MARK: - Helpers

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

    private static let fixtureGroupId =
        UUID(uuidString: "11111111-2222-3333-4444-555555555555") ?? UUID()

    /// A `{ spreadGroupId, lines[2], createdBudgets[1], skippedMonths[1] }` payload.
    private static func successResponseData() -> Data {
        let json = """
        {
          "success": true,
          "data": {
            "spreadGroupId": "\(fixtureGroupId.uuidString)",
            "lines": [
              \(lineJSON(id: "line-jun", budgetId: "budget-jun")),
              \(lineJSON(id: "line-jul", budgetId: "budget-jul"))
            ],
            "createdBudgets": [
              \(budgetJSON(id: "budget-jul", month: 7))
            ],
            "skippedMonths": [{ "month": 8, "year": 2026 }]
          }
        }
        """
        return Data(json.utf8)
    }

    /// A `{ spreadGroupId, lines[1], createdBudgets[], skippedMonths[] }` payload.
    private static func responseDataNoSkips() -> Data {
        let json = """
        {
          "success": true,
          "data": {
            "spreadGroupId": "\(fixtureGroupId.uuidString)",
            "lines": [ \(lineJSON(id: "line-jun", budgetId: "budget-jun")) ],
            "createdBudgets": [],
            "skippedMonths": []
          }
        }
        """
        return Data(json.utf8)
    }

    private static func lineJSON(id: String, budgetId: String) -> String {
        """
        {
          "id": "\(id)",
          "budgetId": "\(budgetId)",
          "templateLineId": null,
          "savingsGoalId": null,
          "name": "Impôts",
          "amount": 80,
          "kind": "expense",
          "recurrence": "one_off",
          "isManuallyAdjusted": false,
          "checkedAt": null,
          "createdAt": "2026-06-01T00:00:00Z",
          "updatedAt": "2026-06-01T00:00:00Z",
          "spreadGroupId": "\(fixtureGroupId.uuidString)"
        }
        """
    }

    private static func budgetJSON(id: String, month: Int) -> String {
        """
        {
          "id": "\(id)",
          "month": \(month),
          "year": 2026,
          "description": "Budget",
          "userId": "user-1",
          "templateId": "template-1",
          "endingBalance": null,
          "rollover": null,
          "remaining": null,
          "previousBudgetId": null,
          "createdAt": "2026-06-01T00:00:00Z",
          "updatedAt": "2026-06-01T00:00:00Z"
        }
        """
    }
}

/// Decoded mirror of the outgoing `BudgetLineSpreadCreate` JSON. Decoding the
/// recorded request body (rather than reaching into the `Encodable`) proves the
/// actual wire shape the backend receives.
private struct DecodedSpreadBody: Decodable {
    struct MonthRef: Decodable {
        let year: Int
        let month: Int
    }

    let name: String
    let kind: String
    let mode: String
    let months: [MonthRef]
    let perMonthAmount: Decimal?
    let perMonthOriginalAmount: Decimal?
    let totalAmount: Decimal?
    let totalOriginalAmount: Decimal?
    let originalCurrency: String?
    let targetCurrency: String?
    let exchangeRate: Decimal?
}

private struct TranchePair: Equatable {
    let year: Int
    let month: Int
    init(_ year: Int, _ month: Int) {
        self.year = year
        self.month = month
    }
}

/// Captures the outgoing request and exposes its decoded JSON body. `URLProtocol`
/// strips `httpBody` in some paths, so we read `httpBodyStream` as a fallback.
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

    var decodedBody: DecodedSpreadBody? {
        guard let data = bodyData else { return nil }
        return try? JSONDecoder().decode(DecodedSpreadBody.self, from: data)
    }

    private var bodyData: Data? {
        guard let request else { return nil }
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 1024
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
