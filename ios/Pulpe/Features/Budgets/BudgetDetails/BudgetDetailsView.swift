import SwiftUI

struct BudgetDetailsView: View {
    let budgetId: String
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?

    init(budgetId: String) {
        self.budgetId = budgetId
        self._viewModel = State(initialValue: BudgetDetailsViewModel(budgetId: budgetId))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.budget == nil {
                LoadingView(message: "Chargement...")
            } else if let error = viewModel.error, viewModel.budget == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
            } else if viewModel.budget != nil {
                content
            }
        }
        .navigationTitle(viewModel.budget?.monthYear ?? "Budget")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadDetails()
        }
        .sheet(item: $selectedLineForTransaction) { line in
            AddAllocatedTransactionSheet(budgetLine: line) { transaction in
                viewModel.addTransaction(transaction)
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Hero balance card (Revolut-style)
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    onTapProgress: {}
                )
                .padding(.horizontal)

                // Income section
                if !viewModel.incomeLines.isEmpty {
                    RecurringExpensesList(
                        title: "Revenus",
                        items: viewModel.incomeLines,
                        transactions: viewModel.transactions,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line) }
                        },
                        onAddTransaction: { line in
                            selectedLineForTransaction = line
                        },
                        onLongPress: { _, _ in }
                    )
                }

                // Expense section
                if !viewModel.expenseLines.isEmpty {
                    RecurringExpensesList(
                        title: "Dépenses",
                        items: viewModel.expenseLines,
                        transactions: viewModel.transactions,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line) }
                        },
                        onAddTransaction: { line in
                            selectedLineForTransaction = line
                        },
                        onLongPress: { _, _ in }
                    )
                }

                // Saving section
                if !viewModel.savingLines.isEmpty {
                    RecurringExpensesList(
                        title: "Épargne",
                        items: viewModel.savingLines,
                        transactions: viewModel.transactions,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line) }
                        },
                        onAddTransaction: { line in
                            selectedLineForTransaction = line
                        },
                        onLongPress: { _, _ in }
                    )
                }

                // Free transactions
                if !viewModel.freeTransactions.isEmpty {
                    OneTimeExpensesList(
                        title: "Transactions libres",
                        transactions: viewModel.freeTransactions,
                        onToggle: { transaction in
                            Task { await viewModel.toggleTransaction(transaction) }
                        },
                        onDelete: { transaction in
                            Task { await viewModel.deleteTransaction(transaction) }
                        }
                    )
                }

                Spacer(minLength: 80)
            }
            .padding(.vertical)
        }
        .refreshable {
            await viewModel.loadDetails()
        }
    }
}

// MARK: - ViewModel

@Observable
final class BudgetDetailsViewModel {
    let budgetId: String

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    private let budgetService = BudgetService.shared
    private let budgetLineService = BudgetLineService.shared
    private let transactionService = TransactionService.shared

    init(budgetId: String) {
        self.budgetId = budgetId
    }

    var metrics: BudgetFormulas.Metrics {
        BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    var incomeLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .income }
    }

    var expenseLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .expense }
    }

    var savingLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .saving }
    }

    var freeTransactions: [Transaction] {
        transactions.filter { $0.budgetLineId == nil }
    }

    @MainActor
    func loadDetails() async {
        isLoading = true
        error = nil

        do {
            let details = try await budgetService.getBudgetWithDetails(id: budgetId)
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
        guard !(line.isRollover ?? false) else { return }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            await loadDetails()
        } catch {
            self.error = error
        }
    }

    @MainActor
    func toggleTransaction(_ transaction: Transaction) async {
        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            await loadDetails()
        } catch {
            self.error = error
        }
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
    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
