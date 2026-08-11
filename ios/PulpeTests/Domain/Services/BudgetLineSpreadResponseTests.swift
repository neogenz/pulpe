import Foundation
@testable import Pulpe
import Testing

/// PUL-17 Lot A — decoding of the `{ spreadGroupId, lines, createdBudgets,
/// skippedMonths }` response from `POST /budget-lines/spread`. Split out of
/// `BudgetLineSpreadRequestTests`, which covers what goes out on the wire; this
/// covers what comes back.
@Suite("BudgetLineService.createSpread response decoding", .serialized)
struct BudgetLineSpreadResponseTests {
    @Test
    func createSpread_decodesSpreadResponse() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.successResponseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Impôts",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 80
        )

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
        let response: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        #expect(response.spreadGroupId == fixtureGroupId)
        #expect(response.lines.count == 2)
        #expect(response.lines.allSatisfy { $0.spreadGroupId == fixtureGroupId })
        #expect(response.createdBudgets.count == 1)
        #expect(response.createdBudgets.first?.id == "budget-jul")
        #expect(response.skippedMonths == [SpreadSkippedMonth(month: 8, year: 2026)])
    }

    @Test
    func createSpread_decodesEmptySkippedMonths() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 200), BudgetLineSpreadFixtures.responseDataNoSkips())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let body = BudgetLineSpreadCreate(
            name: "Impôts",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 80
        )

        let apiClient = BudgetLineSpreadFixtures.makeAPIClient()
        let response: BudgetLineSpreadResponse = try await apiClient.request(
            .budgetLinesSpread, body: body, method: .post
        )

        #expect(response.skippedMonths.isEmpty)
        #expect(response.createdBudgets.isEmpty)
        #expect(response.lines.count == 1)
    }
}
