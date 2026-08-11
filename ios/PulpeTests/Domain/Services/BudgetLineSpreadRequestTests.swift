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
///     whole spread; FX keys are absent for a same-currency spread.
///
/// Response decoding lives in `BudgetLineSpreadResponseTests`; shared fixtures
/// (`BudgetLineSpreadFixtures.makeAPIClient()`, canned JSON, `SpreadRequestRecorder`)
/// live in `BudgetLineSpreadTestFixtures`.
@Suite("BudgetLineService.createSpread contract", .serialized)
struct BudgetLineSpreadRequestTests {
    // MARK: - Request body: per-month amount + one month ref per selected month

    @Test
    func createSpread_postsPerMonthAmountAndOneRefPerSelectedMonth() async throws {
        let recorder = SpreadRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
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

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
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
        let recorder = SpreadRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Épargne",
            kind: kind,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 200
        )

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let decoded = try #require(recorder.decodedBody)
        #expect(decoded.kind == expected)
    }

    // MARK: - Single frozen exchangeRate + perMonthOriginalAmount for the whole spread

    @Test
    func createSpread_sendsOneFrozenExchangeRateAndOnePerMonthOriginalAmount() async throws {
        let recorder = SpreadRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
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

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
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
        let recorder = SpreadRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
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

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
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
        let recorder = SpreadRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Loyer ponctuel",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 500
        )

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
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

    // MARK: - Idempotency key on the wire (PUL-17)

    @Test
    func createSpread_sendsClientSpreadGroupIdUnderTheSpreadGroupIdKey() async throws {
        let recorder = SpreadRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let groupId = "b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b"
        let body = BudgetLineSpreadCreate(
            name: "Impôts",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 80,
            spreadGroupId: groupId
        )

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
        let _: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        let decoded = try #require(recorder.decodedBody)
        // The idempotency key rides on the wire under the `spreadGroupId` JSON key.
        #expect(decoded.spreadGroupId == groupId)
    }
}

private struct TranchePair: Equatable {
    let year: Int
    let month: Int
    init(_ year: Int, _ month: Int) {
        self.year = year
        self.month = month
    }
}
