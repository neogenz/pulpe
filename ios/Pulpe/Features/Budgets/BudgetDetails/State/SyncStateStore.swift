import Foundation
import SwiftUI

/// Tracks transient sync state for the BudgetDetails screen — which budget
/// lines / transactions are currently in-flight, the global loading flag,
/// surfaced errors, and the alert state for "Pointer les transactions ?".
///
/// Mutated exclusively by `BudgetDetailsCoordinator`; views read it as a
/// signal source for sync indicators, error banners, and the alert binding.
@Observable @MainActor
final class SyncStateStore {
    private(set) var syncingBudgetLineIds: Set<String> = []
    private(set) var syncingTransactionIds: Set<String> = []

    private(set) var isLoading = false
    private(set) var error: Error?

    /// Bound to the SwiftUI alert presenter — must remain settable from views
    /// so dismissal flows through the binding.
    var showCheckAllTransactionsAlert = false
    private(set) var budgetLineToCheckAll: BudgetLine?

    func markSyncing(lineId: String) {
        syncingBudgetLineIds.insert(lineId)
    }

    func clearSyncing(lineId: String) {
        syncingBudgetLineIds.remove(lineId)
    }

    func isSyncing(lineId: String) -> Bool {
        syncingBudgetLineIds.contains(lineId)
    }

    func markSyncing(txId: String) {
        syncingTransactionIds.insert(txId)
    }

    func clearSyncing(txId: String) {
        syncingTransactionIds.remove(txId)
    }

    func isSyncing(txId: String) -> Bool {
        syncingTransactionIds.contains(txId)
    }

    func setLoading(_ value: Bool) {
        isLoading = value
    }

    func setError(_ error: Error?) {
        self.error = error
    }

    func clearError() {
        error = nil
    }

    func presentCheckAllAlert(for line: BudgetLine) {
        budgetLineToCheckAll = line
        showCheckAllTransactionsAlert = true
    }

    func resetCheckAllState() {
        budgetLineToCheckAll = nil
        showCheckAllTransactionsAlert = false
    }
}
