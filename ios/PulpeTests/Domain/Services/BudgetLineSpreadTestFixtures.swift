import Foundation
@testable import Pulpe

/// Shared test doubles for the PUL-17 spread contract: a test-configured `APIClient`
/// wired to `InterceptingURLProtocol`, canned JSON payloads, and a request recorder
/// that decodes the outgoing body. Used by `BudgetLineSpreadRequestTests` (what goes
/// out) and `BudgetLineSpreadResponseTests` (what comes back).
///
/// An `enum` of `static func`s, not bare top-level functions: the test target already
/// has several `private func makeAPIClient()` (and a `private static func
/// budgetJSON(id:month:)` in `SavingsWithdrawalTests`) with this exact signature.
/// `private` shadows them today, but a bare top-level function of the same name is a
/// silent trap the day one of those private copies is deleted — the call then binds to
/// this one instead, building a different `APIClient` without the caller ever knowing.
let fixtureGroupId =
    UUID(uuidString: "11111111-2222-3333-4444-555555555555") ?? UUID()

enum BudgetLineSpreadFixtures {
    static func makeAPIClient() -> APIClient {
        let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")
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

    /// A `{ spreadGroupId, lines[2], createdBudgets[1], skippedMonths[1] }` payload.
    static func successResponseData() -> Data {
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
    static func responseDataNoSkips() -> Data {
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

    static func lineJSON(id: String, budgetId: String) -> String {
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

    static func budgetJSON(id: String, month: Int) -> String {
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
struct DecodedSpreadBody: Decodable {
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
    let spreadGroupId: String
}

/// Captures the outgoing request and exposes its decoded JSON body. `URLProtocol`
/// strips `httpBody` in some paths, so we read `httpBodyStream` as a fallback.
final class SpreadRequestRecorder: @unchecked Sendable {
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
