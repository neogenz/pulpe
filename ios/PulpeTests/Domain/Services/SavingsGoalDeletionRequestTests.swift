import Foundation
@testable import Pulpe
import Testing

@Suite("SavingsGoal deletion retry contract", .serialized)
struct SavingsGoalDeletionRequestTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    @Test("a transient failure replayed as not found stays typed")
    func deletionRetry_mapsNotFoundAfterTransientFailure() async throws {
        let recorder = DeletionRetryRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            try recorder.respond(to: request)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        do {
            try await makeAPIClient().requestVoid(
                .savingsGoalDeletion(id: "goal-1"),
                body: SavingsGoalDeletionCommand(
                    mode: .goalForecastsAndTransactions,
                    revision: SavingsGoalDeletionRevision(
                        templateLines: [],
                        budgetLines: [],
                        transactions: []
                    )
                ),
                method: .post
            )
            Issue.record("Expected the replay to return a typed not-found error")
        } catch let error as APIError {
            guard case .savingsGoalNotFound = error else {
                Issue.record("Expected savingsGoalNotFound, got \(error)")
                return
            }
        }

        let requests = recorder.requests
        #expect(requests.count == 2)
        #expect(requests.allSatisfy { $0.httpMethod == "POST" })
        #expect(requests.allSatisfy { $0.url?.path == "/savings-goals/goal-1/deletion" })
        #expect(requests.first?.httpBody == requests.last?.httpBody)
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

private final class DeletionRetryRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [URLRequest] = []

    var requests: [URLRequest] {
        lock.withLock { storage }
    }

    func respond(to request: URLRequest) throws -> (HTTPURLResponse, Data) {
        let attempt = lock.withLock {
            storage.append(request)
            return storage.count
        }
        if attempt == 1 {
            throw URLError(.networkConnectionLost)
        }
        let body = """
        {
          "success": false,
          "code": "ERR_SAVINGS_GOAL_NOT_FOUND",
          "message": "Savings goal not found"
        }
        """
        return (
            makeHTTPResponse(for: request, statusCode: 404),
            Data(body.utf8)
        )
    }
}
