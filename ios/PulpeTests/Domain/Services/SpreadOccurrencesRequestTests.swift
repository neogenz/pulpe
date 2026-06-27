import Foundation
@testable import Pulpe
import Testing

/// PUL-17 Lot C — the `GET /budget-lines/spread/:id` contract as exercised by
/// `BudgetLineService.getSpreadOccurrences`. Drives a test-configured `APIClient`
/// over the real decode path, asserting:
///   - the request is a GET on `/budget-lines/spread/{id}`,
///   - the `{ success, data: [...] }` envelope decodes into `[SpreadOccurrence]`,
///   - `checkedAt` / `originalAmount` are optional and survive null/absent,
///   - `period` reflects the flattened month/year for payDay-aware comparison.
@Suite("BudgetLineService.getSpreadOccurrences contract", .serialized)
struct SpreadOccurrencesRequestTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    @Test
    func getSpreadOccurrences_getsCorrectPath_andDecodesEnvelope() async throws {
        let recorder = OccurrencesRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.path = request.url?.path
            recorder.method = request.httpMethod
            return (makeHTTPResponse(for: request, statusCode: 200), Self.responseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let apiClient = makeAPIClient()
        let occurrences: [SpreadOccurrence] = try await apiClient.request(
            .budgetLinesSpreadOccurrences(spreadGroupId: "group-1"), method: .get
        )

        #expect(recorder.method == "GET")
        #expect(recorder.path == "/budget-lines/spread/group-1")
        #expect(occurrences.count == 3)

        let june = try #require(occurrences.first)
        #expect(june.budgetLineId == "line-jun")
        #expect(june.month == 6)
        #expect(june.year == 2026)
        #expect(june.name == "Impôts")
        #expect(june.amount == 80)
        #expect(june.kind == .expense)
        #expect(june.period == BudgetPeriod(month: 6, year: 2026))
    }

    @Test
    func getSpreadOccurrences_decodesCheckedAndOriginalAmount() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 200), Self.responseData())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let apiClient = makeAPIClient()
        let occurrences: [SpreadOccurrence] = try await apiClient.request(
            .budgetLinesSpreadOccurrences(spreadGroupId: "group-1"), method: .get
        )

        // June: no checkedAt, no originalAmount.
        #expect(occurrences[0].isChecked == false)
        #expect(occurrences[0].originalAmount == nil)
        // July: checked + carries an originalAmount (multi-currency tranche).
        #expect(occurrences[1].isChecked)
        #expect(occurrences[1].originalAmount == 100)
        // August: absent originalAmount key decodes to nil.
        #expect(occurrences[2].originalAmount == nil)
    }

    @Test
    func getSpreadOccurrences_decodesEmptyList() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 200), Data(#"{ "success": true, "data": [] }"#.utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let apiClient = makeAPIClient()
        let occurrences: [SpreadOccurrence] = try await apiClient.request(
            .budgetLinesSpreadOccurrences(spreadGroupId: "group-1"), method: .get
        )

        #expect(occurrences.isEmpty)
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

    private static func responseData() -> Data {
        let json = """
        {
          "success": true,
          "data": [
            {
              "budgetLineId": "line-jun", "budgetId": "budget-jun",
              "month": 6, "year": 2026, "name": "Impôts", "amount": 80,
              "kind": "expense", "checkedAt": null
            },
            {
              "budgetLineId": "line-jul", "budgetId": "budget-jul",
              "month": 7, "year": 2026, "name": "Impôts", "amount": 93,
              "kind": "expense", "checkedAt": "2026-07-02T00:00:00Z", "originalAmount": 100
            },
            {
              "budgetLineId": "line-aug", "budgetId": "budget-aug",
              "month": 8, "year": 2026, "name": "Impôts", "amount": 80,
              "kind": "expense", "checkedAt": null
            }
          ]
        }
        """
        return Data(json.utf8)
    }
}

private final class OccurrencesRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedPath: String?
    private var storedMethod: String?

    var path: String? {
        get { lock.withLock { storedPath } }
        set { lock.withLock { storedPath = newValue } }
    }

    var method: String? {
        get { lock.withLock { storedMethod } }
        set { lock.withLock { storedMethod = newValue } }
    }
}
