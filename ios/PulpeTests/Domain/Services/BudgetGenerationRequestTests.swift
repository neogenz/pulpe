import Foundation
@testable import Pulpe
import Testing

@Suite("BudgetService.generateBudgets contract", .serialized)
struct BudgetGenerationRequestTests {
    @Test
    func generateBudgets_sendsContractAndDecodesResponse() async throws {
        let recorder = BudgetGenerationRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 201), Self.responseData)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let clientKey = TestDataFactory.testClientKey
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let apiClient = APIClient(
            session: URLSession(configuration: configuration),
            baseURL: URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/"),
            authTokenProvider: { "test-token" },
            clientKeyProvider: { clientKey }
        )
        let service = BudgetService(apiClient: apiClient)

        let response = try await service.generateBudgets(BudgetGenerate(
            templateId: "11111111-2222-3333-4444-555555555555",
            startMonth: 9,
            startYear: 2026,
            count: 12
        ))

        let request = try #require(recorder.request)
        #expect(request.url?.path == "/budgets/generate")
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
        #expect(request.value(forHTTPHeaderField: "X-Client-Key") == clientKey)

        let body = try #require(recorder.decodedBody)
        #expect(body.templateId == "11111111-2222-3333-4444-555555555555")
        #expect(body.startMonth == 9)
        #expect(body.startYear == 2026)
        #expect(body.count == 12)

        #expect(response.budgets.map(\.id) == ["budget-september"])
        #expect(response.skippedMonths == [BudgetGenerateSkippedPeriod(month: 10, year: 2026)])
    }

    private static let responseData = Data(
        """
        {
          "success": true,
          "data": {
            "budgets": [{
              "id": "budget-september",
              "month": 9,
              "year": 2026,
              "description": "Septembre 2026",
              "userId": "user-1",
              "templateId": "11111111-2222-3333-4444-555555555555",
              "endingBalance": null,
              "rollover": null,
              "remaining": null,
              "previousBudgetId": null,
              "createdAt": "2026-09-01T00:00:00Z",
              "updatedAt": "2026-09-01T00:00:00Z"
            }],
            "skippedMonths": [{ "month": 10, "year": 2026 }]
          }
        }
        """.utf8
    )
}

private struct DecodedBudgetGenerateBody: Decodable {
    let templateId: String
    let startMonth: Int
    let startYear: Int
    let count: Int
}

private final class BudgetGenerationRequestRecorder: @unchecked Sendable {
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

    var decodedBody: DecodedBudgetGenerateBody? {
        guard let request else { return nil }
        let data: Data?
        if let body = request.httpBody {
            data = body
        } else if let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var streamed = Data()
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let count = stream.read(buffer, maxLength: 1024)
                if count <= 0 { break }
                streamed.append(buffer, count: count)
            }
            data = streamed
        } else {
            data = nil
        }
        return data.flatMap { try? JSONDecoder().decode(DecodedBudgetGenerateBody.self, from: $0) }
    }
}
