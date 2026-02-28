// swiftlint:disable file_length
import Foundation
import OSLog

@Observable @MainActor
final class CurrentMonthStore: StoreProtocol {
    // MARK: - Types

    struct TopSpending: Sendable {
        let name: String
        let amount: Decimal
        let totalExpenses: Decimal
    }

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

    /// Custom pay day used for period resolution (set via loadBudgetSummary)
    private(set) var payDayOfMonth: Int?

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
    /// Generation counter to safely nil loadTask after completion
    private var loadGeneration = 0

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
    func loadBudgetSummary(payDayOfMonth: Int? = nil) async {
        self.payDayOfMonth = payDayOfMonth
        guard budget == nil else { return }
        isLoading = true
        error = nil
        let loadStart = ContinuousClock.now
        defer { isLoading = false }

        do {
            let sparseBudgets = try await budgetService.getBudgetsSparse(
                fields: "month,year",
                limit: 13
            )
            let period = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)

            guard let match = sparseBudgets.first(where: {
                $0.month == period.month && $0.year == period.year
            }) else {
                try await ensureMinimumSkeletonTime(since: loadStart)
                return
            }

            let fetchedBudget = try await budgetService.getBudget(id: match.id)
            try await ensureMinimumSkeletonTime(since: loadStart)
            budget = fetchedBudget
            invalidateMetricsCache()
        } catch is CancellationError {
            // Task was cancelled, don't update error state
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
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch let apiError as APIError {
            self.error = apiError
        } catch {
            self.error = .networkError(error)
        }
    }

    /// Update the stored payDayOfMonth so subsequent forceRefresh() calls use the correct period
    func setPayDay(_ payDay: Int?) {
        payDayOfMonth = payDay
    }

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
        await forceRefresh()
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration = 0
        widgetSyncTask?.cancel()
        widgetSyncTask = nil
        budget = nil
        budgetLines = []
        transactions = []
        payDayOfMonth = nil
        syncingTransactionIds = []
        syncingBudgetLineIds = []
        lastLoadTime = nil
        cachedMetrics = nil
        cachedRealizedMetrics = nil
        error = nil
    }

    func forceRefresh() async {
        // Cancel any existing load task to avoid duplicate requests
        loadTask?.cancel()

        loadGeneration += 1
        let currentGeneration = loadGeneration

        let task = Task {
            let showsSkeleton = budget == nil
            isLoading = true
            error = nil
            let loadStart = ContinuousClock.now
            defer { isLoading = false }

            do {
                guard let currentBudget = try await budgetService.getCurrentMonthBudget(
                    payDayOfMonth: self.payDayOfMonth
                ) else {
                    if showsSkeleton {
                        try await ensureMinimumSkeletonTime(since: loadStart)
                    }
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

                if showsSkeleton {
                    try await ensureMinimumSkeletonTime(since: loadStart)
                }

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
        if loadGeneration == currentGeneration { loadTask = nil }
    }

    // MARK: - Widget Sync

    private func syncWidgetData(details: BudgetDetails?) async {
        // Use centralized sync for consistency
        await widgetSyncService.syncAll(payDayOfMonth: payDayOfMonth)
    }

    private func syncWidgetAfterChange() async {
        // Cancel any pending sync task
        widgetSyncTask?.cancel()

        // Debounce widget sync to avoid excessive reloads
        widgetSyncTask = Task {
            try? await Task.sleep(for: .seconds(AppConfiguration.widgetSyncDebounceDelay))

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
}

// MARK: - Computed Properties

extension CurrentMonthStore {
    /// Days remaining in the current budget period
    func daysRemaining() -> Int {
        let calendar = Calendar.current
        let today = Date()

        if let payDay = payDayOfMonth, payDay > 1, let budget {
            let periodDates = BudgetPeriodCalculator.periodDates(
                month: budget.month, year: budget.year, payDayOfMonth: payDay
            )
            let remaining = calendar.dateComponents([.day], from: today, to: periodDates.endDate).day ?? 0
            return max(remaining + 1, 1)
        }

        // Standard calendar month
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
    func dailyBudget() -> Decimal {
        let days = daysRemaining()
        guard days > 0, metrics.remaining > 0 else { return 0 }
        return metrics.remaining / Decimal(days)
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
    var topSpending: TopSpending? {
        guard let top = transactions.filter({ $0.kind == .expense }).max(by: { $0.amount < $1.amount }) else {
            return nil
        }
        return TopSpending(name: top.name, amount: top.amount, totalExpenses: metrics.totalExpenses)
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
}

// MARK: - Mutations

extension CurrentMonthStore {
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
        await forceRefresh()
    }
}
