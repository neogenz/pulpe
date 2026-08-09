import Foundation
@testable import Pulpe
import Testing

/// Routes and wire decoding for the PUL-329 read endpoints, exercised through the
/// real `APIClient` so the `{ success, data }` unwrapping and the date strategy
/// are part of the contract, not an assumption.
@Suite("SavingsGoal withdrawal endpoints", .serialized)
struct SavingsGoalServiceTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    @Test
    func withdrawalOptions_callsTheCollectionRoute_andDecodesBalances() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (
                makeHTTPResponse(for: request, statusCode: 200),
                Data("""
                {
                  "success": true,
                  "data": [{
                    "goalId": "11111111-1111-4111-8111-111111111111",
                    "name": "Maison",
                    "status": "ACTIVE",
                    "availableAmount": 10000.55,
                    "currency": "CHF"
                  }]
                }
                """.utf8)
            )
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let options: [SavingsGoalWithdrawalOption] = try await makeAPIClient()
            .request(.savingsGoalWithdrawalOptions, method: .get)

        #expect(recorder.method == "GET")
        #expect(recorder.path == "/savings-goals/withdrawal-options")
        let option = try #require(options.first)
        #expect(option.name == "Maison")
        #expect(option.availableAmount == Decimal(string: "10000.55"))
    }

    @Test
    func withdrawals_callsTheGoalScopedRoute_andKeepsServerOrder() async throws {
        let recorder = RequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (
                makeHTTPResponse(for: request, statusCode: 200),
                Data("""
                {
                  "success": true,
                  "data": [
                    {
                      "transactionId": "22222222-2222-4222-8222-222222222222",
                      "budgetId": "44444444-4444-4444-8444-444444444444",
                      "name": "Apport cuisine",
                      "transactionDate": "2026-07-20T10:00:00Z",
                      "amount": 800
                    },
                    {
                      "transactionId": "33333333-3333-4333-8333-333333333333",
                      "budgetId": "44444444-4444-4444-8444-444444444444",
                      "name": "Apport imprévu",
                      "transactionDate": "2026-06-02T10:00:00Z",
                      "amount": 500
                    }
                  ],
                  "planned": [{
                    "budgetLineId": "55555555-5555-4555-8555-555555555555",
                    "budgetId": "44444444-4444-4444-8444-444444444444",
                    "name": "Apport septembre",
                    "month": 9,
                    "year": 2026,
                    "plannedAmount": 4500,
                    "realizedAmount": 800,
                    "remainingAmount": 3700,
                    "status": "partially_realized"
                  }]
                }
                """.utf8)
            )
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let readModel: SavingsGoalWithdrawalsReadModel = try await makeAPIClient()
            .request(.savingsGoalWithdrawals(id: "goal-1"), method: .get)

        #expect(recorder.method == "GET")
        #expect(recorder.path == "/savings-goals/goal-1/withdrawals")
        #expect(readModel.withdrawals.map(\.name) == ["Apport cuisine", "Apport imprévu"])
        #expect(readModel.planned.first?.remainingAmount == 3700)
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

private final class RequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedPath: String?
    private var storedMethod: String?

    func record(_ request: URLRequest) {
        lock.lock()
        defer { lock.unlock() }
        storedPath = request.url?.path
        storedMethod = request.httpMethod
    }

    var path: String? {
        lock.lock()
        defer { lock.unlock() }
        return storedPath
    }

    var method: String? {
        lock.lock()
        defer { lock.unlock() }
        return storedMethod
    }
}
