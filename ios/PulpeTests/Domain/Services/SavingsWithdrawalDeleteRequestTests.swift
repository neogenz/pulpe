import Foundation
@testable import Pulpe
import Testing

/// PUL-292 (CA1) — the DELETE contract behind
/// `BudgetLineService.deleteSavingsWithdrawal`. The service init is private, so
/// (like `BudgetLineSpreadRequestTests`) this drives a test-configured
/// `APIClient` over the SAME `.budgetLinesSavingsWithdrawalDelete` endpoint the
/// service uses: the request carries the group id in the path + the scope as a
/// query item, and a 404 body decodes to a typed `APIError`.
@Suite("BudgetLineService.deleteSavingsWithdrawal contract", .serialized)
struct SavingsWithdrawalDeleteRequestTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")
    private let groupId = "b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b"

    @Test("scope rides the query for each variant", arguments: [
        (SavingsWithdrawalDeleteScope.pair, "pair"),
        (SavingsWithdrawalDeleteScope.repayment, "repayment"),
    ])
    func deleteSavingsWithdrawal_sendsGroupIdPath_andScopeQuery(
        scope: SavingsWithdrawalDeleteScope,
        expected: String
    ) async throws {
        let recorder = RequestURLRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 200), Data("{\"success\":true}".utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        try await makeAPIClient().requestVoid(
            .budgetLinesSavingsWithdrawalDelete(groupId: groupId, scope: scope.rawValue),
            method: .delete
        )

        let request = try #require(recorder.request)
        #expect(request.httpMethod == "DELETE")
        #expect(request.url?.path == "/budget-lines/savings-withdrawal/\(groupId)")
        let components = URLComponents(url: try #require(request.url), resolvingAgainstBaseURL: false)
        let scopeItem = components?.queryItems?.first { $0.name == "scope" }
        #expect(scopeItem?.value == expected)
    }

    @Test
    func deleteSavingsWithdrawal_decodesTypedError_on404() async {
        InterceptingURLProtocol.requestHandler = { request in
            (makeHTTPResponse(for: request, statusCode: 404), Data("{\"success\":false}".utf8))
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        await #expect(throws: APIError.self) {
            try await makeAPIClient().requestVoid(
                .budgetLinesSavingsWithdrawalDelete(groupId: groupId, scope: "pair"),
                method: .delete
            )
        }
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
}

/// Captures the outgoing request URL for path/query assertions.
private final class RequestURLRecorder: @unchecked Sendable {
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
