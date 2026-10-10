import Foundation
@testable import Pulpe
import Testing

@MainActor
@Suite(.serialized)
struct TransactionServiceTests {
    @Test(arguments: [201, 400, 200])
    func creation_isCapturedOnceOnlyAfterDecodedSuccess(status: Int) async throws {
        let responseData = Self.responseData
        InterceptingURLProtocol.requestHandler = { request in
            let body = status == 200 ? Data("{\"success\":true,\"data\":{}}".utf8) : responseData
            return (makeHTTPResponse(for: request, statusCode: status), body)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let clientKey = TestDataFactory.testClientKey
        let api = APIClient(
            session: URLSession(configuration: configuration),
            baseURL: try #require(URL(string: "https://pulpe.test")),
            authTokenProvider: { "test-token" },
            clientKeyProvider: { clientKey }
        )
        var captured: [TransactionKind] = []
        let service = TransactionService(apiClient: api, captureCreated: { captured.append($0) })
        let input = TransactionCreate(budgetId: "budget-1", name: "Private label", amount: 12, kind: .expense)

        if status == 201 {
            let transaction = try await service.createTransaction(input)
            #expect(transaction.id == "tx-1")
            #expect(captured == [.expense])
        } else {
            await #expect(throws: APIError.self) {
                try await service.createTransaction(input)
            }
            #expect(captured.isEmpty)
        }
    }

    private static let responseData = Data(
        """
        {"success":true,"data":{
          "id":"tx-1","budgetId":"budget-1","name":"Private label","amount":12,"kind":"expense",
          "transactionDate":"2026-10-10T00:00:00Z",
          "createdAt":"2026-10-10T00:00:00Z","updatedAt":"2026-10-10T00:00:00Z"
        }}
        """.utf8
    )
}
