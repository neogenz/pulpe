import Foundation
import OSLog

@Observable @MainActor
final class CurrentMonthStore: StoreProtocol {
    // MARK: - State

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: APIError?
    
    /// Returns true if the store has an error and no budget data to display
    var hasError: Bool {
        error != nil && budget == nil
    }

    // Track IDs of items currently syncing for visual feedback
    private(set) var syncingTransactionIds: Set<String> = []
    private(set) var syncingBudgetLineIds: Set<String> = []

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?
    
    // Cache for expensive computed properties
    private var cachedMetrics: BudgetFormulas.Metrics?
    private var cachedRealizedMetrics: BudgetFormulas.RealizedMetrics?
    
    // Widget sync debouncing
    private var widgetSyncTask: Task<Void, Never>?
    
    /// Coalescing task to prevent concurrent API loads
    private var loadTask: Task<Void, Never>?

    private var isCacheValid: Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity
    }

    // MARK: - Services

    private let budgetService: BudgetService
    private let budgetLineService: BudgetLineService
    private let transactionService: TransactionService
    private let widgetSyncService: WidgetDataSyncService

    // MARK: - Initialization

    init(
        budgetService: BudgetService = .shared,
        budgetLineService: BudgetLineService = .shared,
        transactionService: TransactionService = .shared,
        widgetSyncService: WidgetDataSyncService = .shared
    ) {
        self.budgetService = budgetService
        self.budgetLineService = budgetLineService
        self.transactionService = transactionService
        self.widgetSyncService = widgetSyncService
    }

    // MARK: - Smart Loading (StoreProtocol)

    /// Lightweight loading: only fetches budget summary via GET /budgets
    /// Use this at app startup to quickly enable the "+" button
    func loadBudgetSummary() async {
        guard budget == nil else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let sparseBudgets = try await budgetService.getBudgetsSparse(
                fields: "month,year",
                limit: 13
            )
            let calendar = Calendar.current
            let now = Date()
            let currentMonth = calendar.component(.month, from: now)
            let currentYear = calendar.component(.year, from: now)

            guard let match = sparseBudgets.first(where: {
                $0.month == currentMonth && $0.year == currentYear
            }) else { return }

            let fetchedBudget = try await budgetService.getBudget(id: match.id)
            budget = fetchedBudget
            invalidateMetricsCache()
        } catch let apiError as APIError {
            self.error = apiError
        } catch {
            self.error = .networkError(error)
        }
    }

    /// Loads details (transactions + budget lines) when the view needs them
    func loadDetailsIfNeeded() async {
        guard !isCacheValid else { return }
        await loadDetails()
    }

    /// Full data loading - called when view needs transactions and budget lines
    private func loadDetails() async {
        guard let currentBudget = budget else {
            // No budget summary loaded yet, load everything
            await forceRefresh()
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
            invalidateMetricsCache()
            lastLoadTime = Date()
        } catch let apiError as APIError {
            self.error = apiError
        } catch {
            self.error = .networkError(error)
        }
    }

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
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
                guard let currentBudget = try await budgetService.getCurrentMonthBudget() else {
                    budget = nil
                    budgetLines = []
                    transactions = []
                    invalidateMetricsCache()
                    lastLoadTime = Date()
                    return
                }

                // Check for cancellation before expensive network call
                try Task.checkCancellation()
                
                let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
                budget = details.budget
                budgetLines = details.budgetLines
                transactions = details.transactions
                invalidateMetricsCache()
                lastLoadTime = Date()
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

    // MARK: - Widget Sync

    private func syncWidgetData(details: BudgetDetails?) async {
        // Use centralized sync for consistency
        await widgetSyncService.syncAll()
    }

    private func syncWidgetAfterChange() async {
        // Cancel any pending sync task
        widgetSyncTask?.cancel()
        
        // Debounce widget sync to avoid excessive reloads
        widgetSyncTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(AppConfiguration.widgetSyncDebounceDelay * 1_000_000_000))
            
            guard !Task.isCancelled else { return }
            guard let currentBudget = budget else { return }

            let details = BudgetDetails(
                budget: currentBudget,
                transactions: transactions,
                budgetLines: budgetLines
            )

            await syncWidgetData(details: details)
        }
    }

    // MARK: - Computed Properties (cached to avoid recalculation)

    var metrics: BudgetFormulas.Metrics {
        cachedMetrics ?? BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    var realizedMetrics: BudgetFormulas.RealizedMetrics {
        cachedRealizedMetrics ?? BudgetFormulas.calculateRealizedMetrics(
            budgetLines: budgetLines,
            transactions: transactions
        )
    }
    
    /// Recompute and cache metrics - call after data changes
    private func invalidateMetricsCache() {
        cachedMetrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
        cachedRealizedMetrics = BudgetFormulas.calculateRealizedMetrics(
            budgetLines: budgetLines,
            transactions: transactions
        )
    }

    // MARK: - Dashboard Computed Properties

    /// Days remaining in current month
    var daysRemaining: Int {
        let calendar = Calendar.current
        let today = Date()
        guard let range = calendar.range(of: .day, in: .month, for: today),
              let lastDay = calendar.date(from: DateComponents(
                year: calendar.component(.year, from: today),
                month: calendar.component(.month, from: today),
                day: range.count
              )) else { return 0 }

        let remaining = calendar.dateComponents([.day], from: today, to: lastDay).day ?? 0
        return max(remaining + 1, 1) // Include today
    }

    /// Daily budget available (remaining / days left)
    var dailyBudget: Decimal {
        guard daysRemaining > 0, metrics.remaining > 0 else { return 0 }
        return metrics.remaining / Decimal(daysRemaining)
    }

    /// Budget lines that are at or above 80% consumption (alerts)
    var alertBudgetLines: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)] {
        budgetLines
            .filter { $0.kind.isOutflow && !($0.isRollover ?? false) }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return (line, consumption)
            }
            .sorted { $0.1.percentage > $1.1.percentage }
    }

    /// Top expense transaction by amount (linked or free)
    var topSpending: (name: String, amount: Decimal, totalExpenses: Decimal)? {
        guard let top = transactions.filter({ $0.kind == .expense }).max(by: { $0.amount < $1.amount }) else {
            return nil
        }
        return (name: top.name, amount: top.amount, totalExpenses: metrics.totalExpenses)
    }

    /// 5 most recent transactions (all types)
    var recentTransactions: [Transaction] {
        Array(
            transactions
                .sorted { $0.transactionDate > $1.transactionDate }
                .prefix(5)
        )
    }

    /// Unchecked transactions (not yet pointed, sorted by date desc)
    var uncheckedTransactions: [Transaction] {
        Array(
            transactions
                .filter { !$0.isChecked }
                .sorted { $0.transactionDate > $1.transactionDate }
                .prefix(5)
        )
    }

    /// Forward-looking projection based on current spending rate
    var projection: BudgetFormulas.Projection? {
        guard let budget else { return nil }
        return BudgetFormulas.calculateProjection(
            realizedExpenses: realizedMetrics.realizedExpenses,
            totalBudgetedExpenses: metrics.totalExpenses,
            available: metrics.available,
            month: budget.month,
            year: budget.year
        )
    }

    // MARK: - Legacy Computed (kept for compatibility during transition)

    var displayBudgetLines: [BudgetLine] {
        guard let budget, let rollover = budget.rollover, rollover != 0 else {
            return budgetLines
        }
        // Add virtual rollover line
        let rolloverLine = BudgetLine.rolloverLine(
            amount: rollover,
            budgetId: budget.id,
            sourceBudgetId: budget.previousBudgetId
        )
        return [rolloverLine] + budgetLines
    }

    var recurringBudgetLines: [BudgetLine] {
        displayBudgetLines
            .filter { $0.recurrence == .fixed }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var oneOffBudgetLines: [BudgetLine] {
        displayBudgetLines
            .filter { $0.recurrence == .oneOff && !($0.isRollover ?? false) }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var freeTransactions: [Transaction] {
        transactions
            .filter { $0.budgetLineId == nil }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    // MARK: - Mutations

    func toggleBudgetLine(_ line: BudgetLine) async {
        // Skip virtual rollover lines
        guard !(line.isRollover ?? false) else { return }

        // Skip if already syncing
        guard !syncingBudgetLineIds.contains(line.id) else { return }

        // Mark as syncing
        _ = syncingBudgetLineIds.insert(line.id)

        // Optimistic update
        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
            invalidateMetricsCache()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            // Trust optimistic update - only mark cache as fresh
            lastLoadTime = Date()
        } catch let apiError as APIError {
            // Only refresh on error to rollback
            budgetLines = originalLines
            self.error = apiError
            invalidateMetricsCache()
            await forceRefresh()
        } catch {
            budgetLines = originalLines
            self.error = .networkError(error)
            invalidateMetricsCache()
            await forceRefresh()
        }

        _ = syncingBudgetLineIds.remove(line.id)
    }

    func toggleTransaction(_ transaction: Transaction) async {
        // Skip if already syncing
        guard !syncingTransactionIds.contains(transaction.id) else { return }

        // Mark as syncing
        _ = syncingTransactionIds.insert(transaction.id)

        // Optimistic update
        let originalTransactions = transactions
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction.toggled()
            invalidateMetricsCache()
        }

        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            // Trust optimistic update - only mark cache as fresh
            lastLoadTime = Date()
        } catch let apiError as APIError {
            // Only refresh on error to rollback
            transactions = originalTransactions
            self.error = apiError
            invalidateMetricsCache()
            await forceRefresh()
        } catch {
            transactions = originalTransactions
            self.error = .networkError(error)
            invalidateMetricsCache()
            await forceRefresh()
        }

        _ = syncingTransactionIds.remove(transaction.id)
    }

    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
        invalidateMetricsCache()
        Task {
            await syncWidgetAfterChange()
        }
    }

    func deleteTransaction(_ transaction: Transaction) async {
        // Optimistic update
        let originalTransactions = transactions
        transactions.removeAll { $0.id == transaction.id }
        invalidateMetricsCache()

        do {
            try await transactionService.deleteTransaction(id: transaction.id)
        } catch let apiError as APIError {
            transactions = originalTransactions
            self.error = apiError
            invalidateMetricsCache()
        } catch {
            transactions = originalTransactions
            self.error = .networkError(error)
            invalidateMetricsCache()
        }
    }

    func deleteBudgetLine(_ line: BudgetLine) async {
        // Skip virtual rollover lines
        guard !(line.isRollover ?? false) else { return }

        // Optimistic update
        let originalLines = budgetLines
        budgetLines.removeAll { $0.id == line.id }
        invalidateMetricsCache()

        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
        } catch let apiError as APIError {
            budgetLines = originalLines
            self.error = apiError
            invalidateMetricsCache()
        } catch {
            budgetLines = originalLines
            self.error = .networkError(error)
            invalidateMetricsCache()
        }
    }

    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        // Optimistic update
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
            invalidateMetricsCache()
        }

        // Refresh to get server state (needed for recalculations)
        await forceRefresh()
    }

    func updateTransaction(_ transaction: Transaction) async {
        // Optimistic update
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
            invalidateMetricsCache()
        }

        // Refresh to get server state (needed for recalculations)
        await forceRefresh()
    }
}
