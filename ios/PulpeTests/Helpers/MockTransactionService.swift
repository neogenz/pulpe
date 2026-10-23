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
    private var deleteGate: CheckedContinuation<Void, Never>?
    private var isDeleteGated = false
    var deleteError: Error?
    var postponeError: Error?
    var stubbedToggle: Transaction?
    var stubbedCreated: Transaction?
    var createError: Error?
    private(set) var createdPayloads: [TransactionCreate] = []
    var stubbedUpdated: Transaction?
    /// Transaction ids whose `toggleCheck` should throw — drives partial
    /// bulk-check failures deterministically (PUL-259).
    var failingToggleIds: Set<String> = []
    // Spread-from-existing (PUL-17 v1.1) — stubbed response + recorded inputs.
    var stubbedSpreadResponse: BudgetLineSpreadResponse?
    var spreadError: Error?
    private(set) var spreadFromTxnCalls: [(id: String, periods: [SpreadFromExistingPeriod])] = []

    func gateDelete() { isDeleteGated = true }

    func releaseDelete() {
        isDeleteGated = false
        deleteGate?.resume()
        deleteGate = nil
    }

    func deleteTransaction(id: String) async throws {
        deleteTransactionCallCount += 1
        deletedIds.append(id)
        if isDeleteGated { await withCheckedContinuation { deleteGate = $0 } }
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
        createdPayloads.append(data)
        if let createError { throw createError }
        return stubbedCreated ?? TestDataFactory.createTransaction()
    }

    func updateTransaction(id: String, data: TransactionUpdate) async throws -> Transaction {
        stubbedUpdated ?? TestDataFactory.createTransaction(id: id)
    }

    func spreadExistingTransaction(
        id: String,
        periods: [SpreadFromExistingPeriod]
    ) async throws -> BudgetLineSpreadResponse {
        spreadFromTxnCalls.append((id: id, periods: periods))
        if let spreadError { throw spreadError }
        return stubbedSpreadResponse ?? BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: [],
            createdBudgets: [],
            skippedMonths: []
        )
    }
}
