import Foundation
@testable import Pulpe

/// Test double for `TransactionServicing`. Records delete calls so suites can
/// assert the deferred soft-delete commit actually reaches the server.
///
/// `@MainActor`-isolated (not an `actor`) on purpose: tests are `@MainActor`,
/// so call counts are readable synchronously and can be polled with
/// `waitForCondition` for deterministic assertions on the toast-driven commit.
@MainActor
final class MockTransactionService: TransactionServicing {
    private(set) var deleteTransactionCallCount = 0
    private(set) var deletedIds: [String] = []
    private(set) var postponeCallCount = 0
    private(set) var postponedIds: [String] = []
    var deleteError: Error?
    var postponeError: Error?
    var stubbedToggle: Transaction?
    var stubbedCreated: Transaction?
    var stubbedUpdated: Transaction?
    /// Transaction ids whose `toggleCheck` should throw — drives partial
    /// bulk-check failures deterministically (PUL-259).
    var failingToggleIds: Set<String> = []

    func deleteTransaction(id: String) async throws {
        deleteTransactionCallCount += 1
        deletedIds.append(id)
        if let deleteError { throw deleteError }
    }

    func toggleCheck(id: String) async throws -> Transaction {
        if failingToggleIds.contains(id) { throw URLError(.badServerResponse) }
        return stubbedToggle ?? TestDataFactory.createTransaction(id: id)
    }

    func postpone(id: String) async throws -> Transaction {
        postponeCallCount += 1
        postponedIds.append(id)
        if let postponeError { throw postponeError }
        return TestDataFactory.createTransaction(id: id)
    }

    func createTransaction(_ data: TransactionCreate) async throws -> Transaction {
        stubbedCreated ?? TestDataFactory.createTransaction()
    }

    func updateTransaction(id: String, data: TransactionUpdate) async throws -> Transaction {
        stubbedUpdated ?? TestDataFactory.createTransaction(id: id)
    }
}
