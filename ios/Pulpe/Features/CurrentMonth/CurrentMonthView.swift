import SwiftUI
import WidgetKit

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CurrentMonthViewModel()
    @State private var showAddTransaction = false
    @State private var showRealizedBalanceSheet = false
    @State private var showAccount = false
    @State private var navigateToBudget = false

    var body: some View {
        ZStack {
            if viewModel.isLoading && viewModel.budget == nil {
                LoadingView(message: "Chargement du budget...")
            } else if let error = viewModel.error, viewModel.budget == nil {
                ErrorView(error: error) {
                    await viewModel.loadData()
                }
            } else if viewModel.budget == nil {
                EmptyStateView(
                    title: "Aucun budget",
                    description: "Créez un budget pour ce mois dans l'onglet Budgets",
                    systemImage: "calendar.badge.plus"
                )
            } else {
                dashboardContent
            }
        }
        .navigationTitle("Ce mois-ci")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAccount = true
                } label: {
                    Image(systemName: "person.circle")
                }
                .accessibilityLabel("Mon compte")
            }
        }
        .sheet(isPresented: $showAddTransaction) {
            if let budgetId = viewModel.budget?.id {
                AddTransactionSheet(budgetId: budgetId) { transaction in
                    viewModel.addTransaction(transaction)
                }
            }
        }
        .sheet(isPresented: $showRealizedBalanceSheet) {
            RealizedBalanceSheet(
                metrics: viewModel.metrics,
                realizedMetrics: viewModel.realizedMetrics
            )
        }
        .sheet(isPresented: $showAccount) {
            AccountView()
        }
        .task {
            await viewModel.loadData()
        }
        .onChange(of: navigateToBudget) { _, shouldNavigate in
            if shouldNavigate, let budgetId = viewModel.budget?.id {
                // Navigate to budget details: switch tab + push destination
                appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                appState.selectedTab = .budgets
                navigateToBudget = false
            }
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        List {
            // Hero balance card with daily insight
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    daysRemaining: viewModel.daysRemaining,
                    dailyBudget: viewModel.dailyBudget,
                    onTapProgress: { showRealizedBalanceSheet = true }
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            // Quick actions bar
            Section {
                QuickActionsBar(
                    onAddTransaction: { showAddTransaction = true },
                    onShowStats: { showRealizedBalanceSheet = true },
                    onShowBudget: { navigateToBudget = true }
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            // Alerts section (categories at 80%+)
            AlertsSection(
                alerts: viewModel.alertBudgetLines,
                onTapViewBudget: { navigateToBudget = true }
            )

            // Recent transactions (read-only)
            RecentTransactionsSection(
                transactions: viewModel.recentTransactions,
                onTapViewAll: { navigateToBudget = true }
            )

            // Unchecked transactions (not yet pointed)
            UncheckedTransactionsSection(
                transactions: viewModel.uncheckedTransactions,
                onTapViewBudget: { navigateToBudget = true }
            )
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(16)
        .scrollContentBackground(.hidden)
        .background(Color(.systemGroupedBackground))
        .applyScrollEdgeEffect()
        .refreshable {
            await viewModel.loadData()
        }
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class CurrentMonthViewModel {
    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    // Track IDs of items currently syncing for visual feedback
    private(set) var syncingTransactionIds: Set<String> = []
    private(set) var syncingBudgetLineIds: Set<String> = []

    private let budgetService = BudgetService.shared
    private let budgetLineService = BudgetLineService.shared
    private let transactionService = TransactionService.shared

    // MARK: - Computed

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

    // MARK: - Dashboard computed properties

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

    // MARK: - Legacy computed (kept for compatibility during transition)

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

    // MARK: - Actions

    func loadData() async {
        isLoading = true
        error = nil

        do {
            // Get current month budget
            guard let currentBudget = try await budgetService.getCurrentMonthBudget() else {
                budget = nil
                budgetLines = []
                transactions = []
                isLoading = false
                await syncWidgetData(details: nil)
                return
            }

            // Get full details
            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions

            await syncWidgetData(details: details)
        } catch {
            self.error = error
        }

        isLoading = false
    }

    private func syncWidgetData(details: BudgetDetails?) async {
        do {
            let exportData = try await budgetService.exportAllBudgets()
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details
            )
        } catch {
            #if DEBUG
            print("syncWidgetData: exportAllBudgets failed - \(error)")
            #endif
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details
            )
        }
    }

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
            await loadData()
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
            await loadData()
        } catch {
            transactions = originalTransactions
            self.error = error
        }

        syncingTransactionIds.remove(transaction.id)
    }

    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
        Task { await syncWidgetAfterChange() }
    }

    private func syncWidgetAfterChange() async {
        guard let budget else { return }

        let details = BudgetDetails(
            budget: budget,
            transactions: transactions,
            budgetLines: budgetLines
        )

        do {
            let exportData = try await budgetService.exportAllBudgets()
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details
            )
        } catch {
            #if DEBUG
            print("syncWidgetAfterChange: exportAllBudgets failed - \(error)")
            #endif
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details
            )
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

        await loadData()
    }

    func updateTransaction(_ transaction: Transaction) async {
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
        }

        await loadData()
    }
}

#Preview {
    NavigationStack {
        CurrentMonthView()
    }
    .environment(AppState())
}
