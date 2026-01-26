import Foundation

@Observable @MainActor
final class CurrentMonthStore: StoreProtocol {
    // MARK: - State

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    // Track IDs of items currently syncing for visual feedback
    private(set) var syncingTransactionIds: Set<String> = []
    private(set) var syncingBudgetLineIds: Set<String> = []

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?
    private static let cacheValidityDuration: TimeInterval = 30 // 30 seconds (short for multi-device sync)

    private var isCacheValid: Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < Self.cacheValidityDuration
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
        defer { isLoading = false }
        error = nil

        do {
            let budgets = try await budgetService.getAllBudgets()
            let calendar = Calendar.current
            let now = Date()
            let currentMonth = calendar.component(.month, from: now)
            let currentYear = calendar.component(.year, from: now)

            budget = budgets.first { $0.month == currentMonth && $0.year == currentYear }
        } catch {
            self.error = error
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
        defer { isLoading = false }
        error = nil

        do {
            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
            lastLoadTime = Date()
        } catch {
            self.error = error
        }
    }

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
        await forceRefresh()
    }

    func forceRefresh() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            guard let currentBudget = try await budgetService.getCurrentMonthBudget() else {
                budget = nil
                budgetLines = []
                transactions = []
                lastLoadTime = Date()
                return
            }

            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
            lastLoadTime = Date()
        } catch {
            self.error = error
        }
    }

    // MARK: - Widget Sync

    private func syncWidgetData(details: BudgetDetails?) async {
        do {
            let exportData = try await budgetService.exportAllBudgets()
            await widgetSyncService.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details
            )
        } catch {
            #if DEBUG
            print("syncWidgetData: exportAllBudgets failed - \(error)")
            #endif
            await widgetSyncService.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details
            )
        }
    }

    private func syncWidgetAfterChange() async {
        guard let budget else { return }

        let details = BudgetDetails(
            budget: budget,
            transactions: transactions,
            budgetLines: budgetLines
        )

        await syncWidgetData(details: details)
    }

    // MARK: - Computed Properties

    var metrics: BudgetFormulas.Metrics {
        BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    var realizedMetrics: BudgetFormulas.RealizedMetrics {
        BudgetFormulas.calculateRealizedMetrics(
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

    /// Top spending category by allocated amount (expenses only)
    var topSpendingCategory: (line: BudgetLine, consumption: BudgetFormulas.Consumption)? {
        budgetLines
            .filter { $0.kind == .expense && !($0.isRollover ?? false) }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.allocated > 0 else { return nil }
                return (line, consumption)
            }
            .max { $0.1.allocated < $1.1.allocated }
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
        syncingBudgetLineIds.insert(line.id)

        // Optimistic update
        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            await forceRefresh() // Force fresh data after mutation
        } catch {
            budgetLines = originalLines
            self.error = error
        }

        syncingBudgetLineIds.remove(line.id)
    }

    func toggleTransaction(_ transaction: Transaction) async {
        // Skip if already syncing
        guard !syncingTransactionIds.contains(transaction.id) else { return }

        // Mark as syncing
        syncingTransactionIds.insert(transaction.id)

        // Optimistic update
        let originalTransactions = transactions
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction.toggled()
        }

        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            await forceRefresh() // Force fresh data after mutation
        } catch {
            transactions = originalTransactions
            self.error = error
        }

        syncingTransactionIds.remove(transaction.id)
    }

    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
        Task {
            await syncWidgetAfterChange()
        }
    }

    func deleteTransaction(_ transaction: Transaction) async {
        // Optimistic update
        let originalTransactions = transactions
        transactions.removeAll { $0.id == transaction.id }

        do {
            try await transactionService.deleteTransaction(id: transaction.id)
        } catch {
            transactions = originalTransactions
            self.error = error
        }
    }

    func deleteBudgetLine(_ line: BudgetLine) async {
        // Skip virtual rollover lines
        guard !(line.isRollover ?? false) else { return }

        // Optimistic update
        let originalLines = budgetLines
        budgetLines.removeAll { $0.id == line.id }

        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
        } catch {
            budgetLines = originalLines
            self.error = error
        }
    }

    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
        }

        await forceRefresh()
    }

    func updateTransaction(_ transaction: Transaction) async {
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
        }

        await forceRefresh()
    }
}
