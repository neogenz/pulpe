import Foundation
@testable import Pulpe

/// Test double for `BudgetLineServicing`. Records delete calls so suites can
/// assert the deferred soft-delete commit actually reaches the server.
///
/// `@MainActor`-isolated (not an `actor`) on purpose: tests are `@MainActor`,
/// so call counts are readable synchronously and can be polled with
/// `waitForCondition` for deterministic assertions on the toast-driven commit.
@MainActor
final class MockBudgetLineService: BudgetLineServicing {
    private(set) var deleteBudgetLineCallCount = 0
    private(set) var deletedIds: [String] = []
    var deleteError: Error?
    var stubbedToggle: BudgetLine?

    func deleteBudgetLine(id: String) async throws {
        deleteBudgetLineCallCount += 1
        deletedIds.append(id)
        if let deleteError { throw deleteError }
    }

    func toggleCheck(id: String) async throws -> BudgetLine {
        stubbedToggle ?? TestDataFactory.createBudgetLine(id: id)
    }
}
