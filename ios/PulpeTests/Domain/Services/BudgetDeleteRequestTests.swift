import Foundation
@testable import Pulpe
import Testing

/// PUL-361: the two calls behind "Supprimer ce mois". The delete carries the link
/// handshake as a `confirmLinks` query item; the impact read decodes the server
/// envelope's `data`.
@Suite("BudgetService.deleteBudget / getDeletionImpact contract", .serialized)
struct BudgetDeleteRequestTests {
    private let budgetId = "11111111-2222-3333-4444-555555555555"

    @Test("confirmLinks rides the query of a DELETE on the budget", arguments: [true, false])
    func deleteBudget_sendsDeleteWithConfirmLinksQuery(confirmLinks: Bool) async throws {
        let recorder = BudgetDeleteRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Data("{\"success\":true}".utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        try await makeService().deleteBudget(id: budgetId, confirmLinks: confirmLinks)

        let request = try #require(recorder.request)
        #expect(request.httpMethod == "DELETE")
        #expect(request.url?.path == "/budgets/\(budgetId)")
        let components = URLComponents(url: try #require(request.url), resolvingAgainstBaseURL: false)
        #expect(components?.queryItems?.first { $0.name == "confirmLinks" }?.value == String(confirmLinks))
    }

    @Test
    func deleteBudget_throwsTypedError_onConflict() async {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 409), Data("{\"success\":false}".utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        await #expect(throws: APIError.self) {
            try await makeService().deleteBudget(id: budgetId, confirmLinks: false)
        }
    }

    @Test
    func getDeletionImpact_getsTheImpactPath_andDecodesData() async throws {
        let recorder = BudgetDeleteRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Self.impactResponse)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let impact = try await makeService().getDeletionImpact(id: budgetId)

        let request = try #require(recorder.request)
        #expect(request.httpMethod == "GET")
        #expect(request.url?.path == "/budgets/\(budgetId)/deletion-impact")
        #expect(impact.forecastCount == 4)
        #expect(impact.movementCount == 2)
        #expect(impact.links.spreadForecasts == 1)
        #expect(impact.links.savingsGoalForecasts == 0)
        #expect(impact.links.savingsWithdrawalForecasts == 1)
        #expect(impact.links.savingsWithdrawalMovements == 0)
        #expect(impact.hasLinks)
    }

    // MARK: - Helpers

    private static let impactResponse = Data(
        """
        {
          "success": true,
          "data": {
            "forecastCount": 4,
            "movementCount": 2,
            "links": {
              "spreadForecasts": 1,
              "savingsGoalForecasts": 0,
              "savingsWithdrawalForecasts": 1,
              "savingsWithdrawalMovements": 0
            }
          }
        }
        """.utf8
    )

    private func makeService() -> BudgetService {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        return BudgetService(apiClient: APIClient(
            session: URLSession(configuration: configuration),
            baseURL: URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/"),
            authTokenProvider: { "test-token" },
            clientKeyProvider: { nil }
        ))
    }
}

/// Captures the outgoing request for path/query assertions.
private final class BudgetDeleteRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: URLRequest?

    func record(_ request: URLRequest) {
        lock.lock(); defer { lock.unlock() }
        storage = request
    }

    var request: URLRequest? {
        lock.lock(); defer { lock.unlock() }
        return storage
    }
}
