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

    // Spread (PUL-17) — stubbed responses + recorded inputs so occurrence/spread
    // suites can drive the VM and coordinator without hitting the network.
    var stubbedSpreadResponse: BudgetLineSpreadResponse?
    var stubbedSpreadOccurrences: [SpreadOccurrence] = []
    var spreadError: Error?
    private(set) var createdSpreads: [BudgetLineSpreadCreate] = []
    private(set) var requestedOccurrenceGroupIds: [String] = []
    private(set) var spreadFromLineCalls: [(id: String, periods: [SpreadFromExistingPeriod])] = []

    func deleteBudgetLine(id: String) async throws {
        deleteBudgetLineCallCount += 1
        deletedIds.append(id)
        if let deleteError { throw deleteError }
    }

    func toggleCheck(id: String) async throws -> BudgetLine {
        stubbedToggle ?? TestDataFactory.createBudgetLine(id: id)
    }

    func createSpread(_ data: BudgetLineSpreadCreate) async throws -> BudgetLineSpreadResponse {
        createdSpreads.append(data)
        if let spreadError { throw spreadError }
        return stubbedSpreadResponse ?? BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: [],
            createdBudgets: [],
            skippedMonths: []
        )
    }

    func getSpreadOccurrences(spreadGroupId: String) async throws -> [SpreadOccurrence] {
        requestedOccurrenceGroupIds.append(spreadGroupId)
        if let spreadError { throw spreadError }
        return stubbedSpreadOccurrences
    }

    func spreadExistingBudgetLine(
        id: String,
        periods: [SpreadFromExistingPeriod]
    ) async throws -> BudgetLineSpreadResponse {
        spreadFromLineCalls.append((id: id, periods: periods))
        if let spreadError { throw spreadError }
        return stubbedSpreadResponse ?? BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: [],
            createdBudgets: [],
            skippedMonths: []
        )
    }
}
