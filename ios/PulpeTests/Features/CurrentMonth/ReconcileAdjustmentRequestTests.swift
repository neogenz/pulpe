import Foundation
@testable import Pulpe
import Testing

/// PUL-378 CA44: the gap the reconciliation notes moves no account. Driven through the real
/// write — `ReconcileAccountsFlow` → `TransactionService` → `APIClient` — down to the bytes of
/// the request: a body without the key would let the server apply the default account.
@Suite("CA44: the reconciliation gap goes out with no account", .serialized)
@MainActor
struct ReconcileAdjustmentRequestTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    @Test("the gap's POST body states « Aucun » explicitly")
    func submitAdjustment_postsExplicitNullAccount() async throws {
        let recorder = AdjustmentRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 201), try Self.echo())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let service = TransactionService(apiClient: makeAPIClient(), onCreated: { _ in })
        let flow = ReconcileAccountsFlow(
            budgetId: "budget-current",
            entryName: "Écart avec mes comptes",
            createTransaction: { try await service.createTransaction($0) },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in }
        )
        // Compte courant typed at 5 000 against a « Solde pointé » of 5 080: a gap of −80.
        flow.accounts[0].amountText = "5000"
        flow.compare()

        #expect(await flow.submitAdjustment(realizedBalance: 5080, of: "budget-current") == .written)

        #expect(recorder.method == "POST")
        #expect(recorder.path == "/transactions")
        let body = try #require(recorder.json)
        #expect(body.keys.contains("accountId"))
        #expect(body["accountId"] is NSNull)
        #expect(body["name"] as? String == "Écart avec mes comptes")
        #expect(body["kind"] as? String == "expense")
        #expect((body["amount"] as? NSNumber)?.decimalValue == 80)
    }

    @Test("CA2: with the net_worth flag off the gap's POST body has no account key")
    func submitAdjustment_flagOff_postsNoAccountKey() async throws {
        let recorder = AdjustmentRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 201), try Self.echo())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let service = TransactionService(apiClient: makeAPIClient(), onCreated: { _ in })
        let flow = ReconcileAccountsFlow(
            budgetId: "budget-current",
            entryName: "Écart avec mes comptes",
            createTransaction: { try await service.createTransaction($0) },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in },
            statesAccount: false
        )
        flow.accounts[0].amountText = "5000"
        flow.compare()

        #expect(await flow.submitAdjustment(realizedBalance: 5080, of: "budget-current") == .written)

        let body = try #require(recorder.json)
        #expect(!body.keys.contains("accountId"))
        #expect(body["name"] as? String == "Écart avec mes comptes")
    }

    // MARK: - Helpers

    /// The created entry as `POST /transactions` returns it.
    nonisolated private static func echo() throws -> Data {
        let transaction = TestDataFactory.createTransaction(
            id: "adjustment-1", budgetId: "budget-current", amount: 80, kind: .expense, isChecked: true
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return Data(#"{"success":true,"data":"#.utf8) + (try encoder.encode(transaction)) + Data("}".utf8)
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

private final class AdjustmentRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var request: URLRequest?
    private var body: Data?

    func record(_ request: URLRequest) {
        let body = request.httpBody ?? request.httpBodyStream.map(Self.drain)
        lock.withLock {
            self.request = request
            self.body = body
        }
    }

    var method: String? { lock.withLock { request?.httpMethod } }
    var path: String? { lock.withLock { request?.url?.path } }
    var json: [String: Any]? {
        lock.withLock { body }.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    }

    private static func drain(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
