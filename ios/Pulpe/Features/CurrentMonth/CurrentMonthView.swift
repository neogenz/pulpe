import SwiftUI

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CurrentMonthViewModel()
    @State private var showAddTransaction = false
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var linkedTransactionsContext: LinkedTransactionsContext?

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
                Menu {
                    Button {
                        Task { await viewModel.loadData() }
                    } label: {
                        Label("Actualiser", systemImage: "arrow.clockwise")
                    }

                    Divider()

                    Button(role: .destructive) {
                        Task { await appState.logout() }
                    } label: {
                        Label("Se déconnecter", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
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
        .task {
            await viewModel.loadData()
        }
    }

    private var content: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                VStack(spacing: 20) {
                    // Progress bar
                    BudgetProgressBar(metrics: viewModel.metrics)
                        .padding()
                        .cardStyle()

                    // Financial summary
                    FinancialSummaryRow(metrics: viewModel.metrics)

                    // Recurring expenses section
                    if !viewModel.recurringBudgetLines.isEmpty {
                        RecurringExpensesList(
                            title: "Dépenses récurrentes",
                            items: viewModel.recurringBudgetLines,
                            transactions: viewModel.transactions,
                            onToggle: { line in
                                Task { await viewModel.toggleBudgetLine(line) }
                            },
                            onAddTransaction: { line in
                                selectedLineForTransaction = line
                            },
                            onLongPress: { line, transactions in
                                linkedTransactionsContext = LinkedTransactionsContext(
                                    budgetLine: line,
                                    transactions: transactions
                                )
                            }
                        )
                    }

                    // One-off expenses section
                    if !viewModel.oneOffBudgetLines.isEmpty {
                        RecurringExpensesList(
                            title: "Dépenses prévues",
                            items: viewModel.oneOffBudgetLines,
                            transactions: viewModel.transactions,
                            onToggle: { line in
                                Task { await viewModel.toggleBudgetLine(line) }
                            },
                            onAddTransaction: { line in
                                selectedLineForTransaction = line
                            },
                            onLongPress: { line, transactions in
                                linkedTransactionsContext = LinkedTransactionsContext(
                                    budgetLine: line,
                                    transactions: transactions
                                )
                            }
                        )
                    }

                    // Free transactions
                    if !viewModel.freeTransactions.isEmpty {
                        OneTimeExpensesList(
                            title: "Autres dépenses",
                            transactions: viewModel.freeTransactions,
                            onToggle: { transaction in
                                Task { await viewModel.toggleTransaction(transaction) }
                            },
                            onDelete: { transaction in
                                Task { await viewModel.deleteTransaction(transaction) }
                            }
                        )
                    }

                    Spacer(minLength: 100)
                }
                .padding(.vertical)
            }

            // FAB
            Button {
                showAddTransaction = true
            } label: {
                Image(systemName: "plus")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.accentColor, in: Circle())
                    .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            }
            .padding()
        }
        .refreshable {
            await viewModel.loadData()
        }
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

        // Optimistic update
        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            // Create toggled version (simplified - real implementation would update checkedAt)
            budgetLines[index] = line
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            // Reload to get updated state
            await loadData()
        } catch {
            // Rollback
            budgetLines = originalLines
            self.error = error
        }
    }

    @MainActor
    func toggleTransaction(_ transaction: Transaction) async {
        // Optimistic update
        let originalTransactions = transactions

        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            await loadData()
        } catch {
            transactions = originalTransactions
            self.error = error
        }
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
}

// MARK: - Linked Transactions Context

private struct LinkedTransactionsContext: Identifiable {
    let id = UUID()
    let budgetLine: BudgetLine
    let transactions: [Transaction]
}

#Preview {
    NavigationStack {
        CurrentMonthView()
    }
}
