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
    var sparseError: Error?
    /// Impact returned by `getDeletionImpact` — what deleting the month would remove.
    var stubbedDeletionImpact = BudgetDeletionImpact(
        forecastCount: 0,
        movementCount: 0,
        links: .init(
            spreadForecasts: 0,
            savingsGoalForecasts: 0,
            savingsWithdrawalForecasts: 0,
            savingsWithdrawalMovements: 0
        )
    )
    var deletionImpactError: Error?
    var deleteError: Error?

    private(set) var getBudgetWithDetailsCallCount = 0
    private(set) var getBudgetsSparseCallCount = 0
    private(set) var deletionImpactRequests: [String] = []
    private(set) var deletedBudgets: [(id: String, confirmLinks: Bool)] = []
    /// Flips true the moment a reload enters `getBudgetWithDetails`. Tests poll
    /// this with `waitForCondition` to know the reload reached the gate.
    private(set) var didEnterDetails = false
    private(set) var didEnterSparse = false

    private var gateContinuation: CheckedContinuation<Void, Never>?
    private var isGated = false
    private var sparseGateContinuations: [CheckedContinuation<Void, Never>] = []
    private var isSparseGated = false
    private var deleteGateContinuation: CheckedContinuation<Void, Never>?
    private var isDeleteGated = false

    /// Arm a one-shot gate: the next `deleteBudget` call records itself, then suspends
    /// until `releaseDelete()` — a month deletion caught on the wire.
    func gateDelete() { isDeleteGated = true }

    func releaseDelete() {
        isDeleteGated = false
        deleteGateContinuation?.resume()
        deleteGateContinuation = nil
    }

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

    func gateSparse() { isSparseGated = true }

    func releaseNextSparse() {
        sparseGateContinuations.removeFirst().resume()
    }

    func releaseSparse() {
        isSparseGated = false
        for continuation in sparseGateContinuations {
            continuation.resume()
        }
        sparseGateContinuations.removeAll()
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
        getBudgetsSparseCallCount += 1
        didEnterSparse = true
        let response = (stubbedSparse, sparseError)
        if isSparseGated {
            await withCheckedContinuation { continuation in
                sparseGateContinuations.append(continuation)
            }
        }
        if let error = response.1 { throw error }
        return response.0
    }

    func getDeletionImpact(id: String) async throws -> BudgetDeletionImpact {
        deletionImpactRequests.append(id)
        if let deletionImpactError { throw deletionImpactError }
        return stubbedDeletionImpact
    }

    func deleteBudget(id: String, confirmLinks: Bool) async throws {
        deletedBudgets.append((id, confirmLinks))
        if isDeleteGated {
            await withCheckedContinuation { deleteGateContinuation = $0 }
        }
        if let deleteError { throw deleteError }
    }
}
