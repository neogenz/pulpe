import Foundation

@MainActor
final class BudgetDetailCache {
    static let shared = BudgetDetailCache()

    // MARK: - Types

    struct CachedEntry {
        let budget: Budget
        let budgetLines: [BudgetLine]
        let transactions: [Transaction]
        let fetchedAt: Date
    }

    // MARK: - Constants

    private let maxEntries = 6

    // MARK: - State

    private var entries: [String: CachedEntry] = [:]
    private var allBudgets: [BudgetSparse]?
    private var allBudgetsFetchedAt: Date?

    private init() {}

    // MARK: - Read

    func get(budgetId: String) -> CachedEntry? {
        guard let entry = entries[budgetId],
              Date().timeIntervalSince(entry.fetchedAt) < AppConfiguration.shortCacheValidity else {
            return nil
        }
        return entry
    }

    func getAllBudgets() -> [BudgetSparse]? {
        guard let fetchedAt = allBudgetsFetchedAt,
              Date().timeIntervalSince(fetchedAt) < AppConfiguration.shortCacheValidity else {
            return nil
        }
        return allBudgets
    }

    // MARK: - Write

    func store(budgetId: String, budget: Budget, budgetLines: [BudgetLine], transactions: [Transaction]) {
        entries[budgetId] = CachedEntry(
            budget: budget,
            budgetLines: budgetLines,
            transactions: transactions,
            fetchedAt: Date()
        )

        // Evict oldest entry if cache exceeds max size
        if entries.count > maxEntries,
           let oldest = entries.min(by: { $0.value.fetchedAt < $1.value.fetchedAt }),
           oldest.key != budgetId {
            entries.removeValue(forKey: oldest.key)
        }
    }

    func storeAllBudgets(_ budgets: [BudgetSparse]) {
        allBudgets = budgets
        allBudgetsFetchedAt = Date()
    }

    // MARK: - Invalidation

    func invalidate(budgetId: String) {
        entries[budgetId] = nil
    }

    func invalidateAll() {
        entries.removeAll()
        allBudgets = nil
        allBudgetsFetchedAt = nil
    }

    func reset() {
        invalidateAll()
    }
}
