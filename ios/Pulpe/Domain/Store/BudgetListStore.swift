import Foundation
import OSLog

@Observable @MainActor
final class BudgetListStore: StoreProtocol {
    // MARK: - State

    private(set) var budgets: [BudgetSparse] = []
    private(set) var isLoading = false
    private(set) var error: APIError?
    
    /// Returns true if the store has an error and no budget data to display
    var hasError: Bool {
        error != nil && budgets.isEmpty
    }

    // MARK: - Cache Metadata

    private(set) var hasLoadedOnce = false
    private var lastLoadTime: Date?

    /// Coalescing task to prevent concurrent API loads
    private var loadTask: Task<Void, Never>?

    // MARK: - Services

    private let budgetService: BudgetService
    private let widgetSyncService: WidgetDataSyncService

    // MARK: - Initialization

    init(
        budgetService: BudgetService = .shared,
        widgetSyncService: WidgetDataSyncService = .shared
    ) {
        self.budgetService = budgetService
        self.widgetSyncService = widgetSyncService
    }

    // MARK: - Smart Loading (StoreProtocol)

    func loadIfNeeded() async {
        // Skip if data is fresh
        if let lastLoad = lastLoadTime,
           Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity {
            return
        }
        await forceRefresh()
    }

    func forceRefresh() async {
        // Cancel any existing load task to avoid duplicate requests
        loadTask?.cancel()
        
        let task = Task {
            isLoading = true
            error = nil
            defer { isLoading = false }

            do {
                let fetchedBudgets = try await budgetService.getBudgetsSparse(fields: "month,year,remaining")
                
                // Check for cancellation before updating state
                try Task.checkCancellation()
                
                budgets = fetchedBudgets
                lastLoadTime = Date()
                hasLoadedOnce = true

                // Sync widget data in background (non-blocking)
                Task.detached(priority: .utility) { [widgetSyncService] in
                    await widgetSyncService.syncAll()
                }
            } catch is CancellationError {
                // Task was cancelled, don't update error state
            } catch let apiError as APIError {
                self.error = apiError
            } catch {
                self.error = .networkError(error)
            }
        }
        
        loadTask = task
        await task.value
        loadTask = nil
    }

    // MARK: - Computed Properties

    struct YearGroup {
        let year: Int
        let budgets: [BudgetSparse]
    }

    /// Cached grouped budgets - invalidated when budgets array changes
    private var _cachedGroupedByYear: [YearGroup]?
    private var _cachedBudgetsHash: Int?

    var groupedByYear: [YearGroup] {
        let currentHash = budgets.hashValue
        if let cached = _cachedGroupedByYear, _cachedBudgetsHash == currentHash {
            return cached
        }

        let grouped = Dictionary(grouping: budgets) { $0.year ?? 0 }
        let result = grouped
            .sorted { $0.key < $1.key } // Oldest first, newest last
            .map { year, budgets in
                YearGroup(year: year, budgets: budgets.sorted { ($0.month ?? 0) < ($1.month ?? 0) })
            }

        _cachedGroupedByYear = result
        _cachedBudgetsHash = currentHash
        return result
    }

    var nextAvailableMonth: (month: Int, year: Int)? {
        let calendar = Calendar.current
        let now = Date()
        let maxYearsAhead = AppConfiguration.maxBudgetYearsAhead

        for monthOffset in 0..<(maxYearsAhead * 12) {
            guard let date = calendar.date(byAdding: .month, value: monthOffset, to: now) else {
                continue
            }
            let month = calendar.component(.month, from: date)
            let year = calendar.component(.year, from: date)

            let exists = budgets.contains { $0.month == month && $0.year == year }
            if !exists {
                return (month, year)
            }
        }
        return nil
    }

    // MARK: - Mutations

    func addBudget(_ budget: Budget) {
        budgets.append(BudgetSparse(from: budget))
        lastLoadTime = nil
    }
}
