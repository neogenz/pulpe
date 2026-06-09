import Foundation
@testable import Pulpe

/// Test double for `BudgetServicing`. Drives `BudgetDetailsCoordinator`'s reload
/// paths so the reload-vs-optimistic-mutation race (PUL-257) can be asserted
/// deterministically.
///
/// `@MainActor`-isolated (not an `actor`) on purpose: tests are `@MainActor`, so
/// `didEnterDetails` / call counts are readable synchronously and pollable with
/// `waitForCondition`. A `CheckedContinuation` gate lets a test suspend a reload
/// mid-fetch, interleave an optimistic mutation, then release the stale snapshot.
@MainActor
final class MockBudgetService: BudgetServicing {
    /// Snapshot returned by `getBudgetWithDetails` — the (possibly stale) server
    /// state the reload will try to apply.
    var stubbedDetails = BudgetDetails(
        budget: TestDataFactory.createBudget(),
        transactions: [],
        budgetLines: []
    )
    var stubbedSparse: [BudgetSparse] = []
    var detailsError: Error?

    private(set) var getBudgetWithDetailsCallCount = 0
    /// Flips true the moment a reload enters `getBudgetWithDetails`. Tests poll
    /// this with `waitForCondition` to know the reload reached the gate.
    private(set) var didEnterDetails = false

    private var gateContinuation: CheckedContinuation<Void, Never>?
    private var isGated = false

    /// Arm a one-shot gate: the next `getBudgetWithDetails` call suspends until
    /// `releaseDetails()`. One-shot by design — drive at most one gated call per
    /// instance; `releaseDetails()` disarms so later calls pass through.
    func gateDetails() { isGated = true }

    /// Resume the gated `getBudgetWithDetails` call and disarm the gate, so any
    /// later call on this instance returns immediately instead of suspending on
    /// a continuation that would never resume.
    func releaseDetails() {
        isGated = false
        gateContinuation?.resume()
        gateContinuation = nil
    }

    func getBudgetWithDetails(id: String) async throws -> BudgetDetails {
        getBudgetWithDetailsCallCount += 1
        didEnterDetails = true
        if isGated {
            await withCheckedContinuation { continuation in
                gateContinuation = continuation
            }
        }
        if let detailsError { throw detailsError }
        return stubbedDetails
    }

    func getBudgetsSparse(fields: String, limit: Int?, year: Int?) async throws -> [BudgetSparse] {
        stubbedSparse
    }
}
