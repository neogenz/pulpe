import SwiftUI

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CurrentMonthViewModel()
    @State private var showAddTransaction = false
    @State private var showRealizedBalanceSheet = false
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var linkedTransactionsContext: LinkedTransactionsContext?
    @State private var showAccount = false
    @State private var selectedBudgetLineForEdit: BudgetLine?
    @State private var selectedTransactionForEdit: Transaction?

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
                content
            }
        }
        .navigationTitle("Ce mois-ci")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showRealizedBalanceSheet = true
                } label: {
                    Image(systemName: "chart.bar.fill")
                }
            }

            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAccount = true
                } label: {
                    Image(systemName: "person.circle")
                }
            }

            if #available(iOS 26, *) {
                ToolbarSpacer(.fixed, placement: .primaryAction)
            }

            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddTransaction = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddTransaction) {
            if let budgetId = viewModel.budget?.id {
                AddTransactionSheet(budgetId: budgetId) { transaction in
                    viewModel.addTransaction(transaction)
                }
            }
        }
        .sheet(item: $selectedLineForTransaction) { line in
            AddAllocatedTransactionSheet(budgetLine: line) { transaction in
                viewModel.addTransaction(transaction)
            }
        }
        .sheet(item: $linkedTransactionsContext) { context in
            LinkedTransactionsSheet(
                budgetLine: context.budgetLine,
                transactions: context.transactions,
                onToggle: { transaction in
                    Task { await viewModel.toggleTransaction(transaction) }
                },
                onDelete: { transaction in
                    Task { await viewModel.deleteTransaction(transaction) }
                },
                onAddTransaction: {
                    linkedTransactionsContext = nil
                    selectedLineForTransaction = context.budgetLine
                }
            )
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
        .sheet(item: $selectedBudgetLineForEdit) { line in
            EditBudgetLineSheet(budgetLine: line) { updatedLine in
                Task { await viewModel.updateBudgetLine(updatedLine) }
            }
        }
        .sheet(item: $selectedTransactionForEdit) { transaction in
            EditTransactionSheet(transaction: transaction) { updatedTransaction in
                Task { await viewModel.updateTransaction(updatedTransaction) }
            }
        }
        .task {
            await viewModel.loadData()
        }
    }

    private var content: some View {
        listContent
            .applyScrollEdgeEffect()
            .refreshable {
                await viewModel.loadData()
            }
    }

    private var listContent: some View {
        List {
            // Hero balance card (Revolut-style)
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    onTapProgress: { showRealizedBalanceSheet = true }
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            // Recurring expenses section
            if !viewModel.recurringBudgetLines.isEmpty {
                BudgetSection(
                    title: "Dépenses récurrentes",
                    items: viewModel.recurringBudgetLines,
                    transactions: viewModel.transactions,
                    syncingIds: viewModel.syncingBudgetLineIds,
                    onToggle: { line in
                        Task { await viewModel.toggleBudgetLine(line) }
                    },
                    onDelete: { line in
                        Task { await viewModel.deleteBudgetLine(line) }
                    },
                    onAddTransaction: { line in
                        selectedLineForTransaction = line
                    },
                    onLongPress: { line, transactions in
                        linkedTransactionsContext = LinkedTransactionsContext(
                            budgetLine: line,
                            transactions: transactions
                        )
                    },
                    onEdit: { line in
                        selectedBudgetLineForEdit = line
                    }
                )
            }

            // One-off expenses section
            if !viewModel.oneOffBudgetLines.isEmpty {
                BudgetSection(
                    title: "Dépenses prévues",
                    items: viewModel.oneOffBudgetLines,
                    transactions: viewModel.transactions,
                    syncingIds: viewModel.syncingBudgetLineIds,
                    onToggle: { line in
                        Task { await viewModel.toggleBudgetLine(line) }
                    },
                    onDelete: { line in
                        Task { await viewModel.deleteBudgetLine(line) }
                    },
                    onAddTransaction: { line in
                        selectedLineForTransaction = line
                    },
                    onLongPress: { line, transactions in
                        linkedTransactionsContext = LinkedTransactionsContext(
                            budgetLine: line,
                            transactions: transactions
                        )
                    },
                    onEdit: { line in
                        selectedBudgetLineForEdit = line
                    }
                )
            }

            // Free transactions
            if !viewModel.freeTransactions.isEmpty {
                TransactionSection(
                    title: "Autres dépenses",
                    transactions: viewModel.freeTransactions,
                    syncingIds: viewModel.syncingTransactionIds,
                    onToggle: { transaction in
                        Task { await viewModel.toggleTransaction(transaction) }
                    },
                    onDelete: { transaction in
                        Task { await viewModel.deleteTransaction(transaction) }
                    },
                    onEdit: { transaction in
                        selectedTransactionForEdit = transaction
                    }
                )
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(16)
        .scrollContentBackground(.hidden)
        .background(Color(.systemGroupedBackground))
    }

}

// MARK: - ViewModel

@Observable
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
        displayBudgetLines.filter { $0.recurrence == .fixed }
    }

    var oneOffBudgetLines: [BudgetLine] {
        displayBudgetLines.filter { $0.recurrence == .oneOff && !($0.isRollover ?? false) }
    }

    var freeTransactions: [Transaction] {
        transactions.filter { $0.budgetLineId == nil }
    }

    // MARK: - Actions

    @MainActor
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
                return
            }

            // Get full details
            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
        } catch {
            self.error = error
        }

        isLoading = false
    }

    @MainActor
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

    @MainActor
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

    @MainActor
    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
    }

    @MainActor
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

    @MainActor
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

    @MainActor
    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
        }

        await loadData()
    }

    @MainActor
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
}
