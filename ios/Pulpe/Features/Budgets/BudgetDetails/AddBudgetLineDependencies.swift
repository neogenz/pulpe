import Foundation

/// Injectable server + cache seams for `AddBudgetLineSheet`, split into its own
/// file to keep the sheet under the feature's 350-LOC budget.
struct AddBudgetLineDependencies: Sendable {
    var createBudgetLine: @Sendable (BudgetLineCreate) async throws -> BudgetLine
    var createSpread: @Sendable (BudgetLineSpreadCreate) async throws -> BudgetLineSpreadResponse
    /// Cross-budget cache invalidation fired on spread success — OUTSIDE the
    /// BudgetDetails coordinator. Injectable so tests can assert it ran.
    var invalidateCrossBudgetCaches: @MainActor (BudgetListStore) -> Void

    static let live = AddBudgetLineDependencies(
        createBudgetLine: { data in
            try await BudgetLineService.shared.createBudgetLine(data)
        },
        createSpread: { data in
            try await BudgetLineService.shared.createSpread(data)
        },
        invalidateCrossBudgetCaches: { budgetListStore in
            BudgetDetailCache.shared.invalidateAll()
            budgetListStore.invalidateCache()
        }
    )
}
