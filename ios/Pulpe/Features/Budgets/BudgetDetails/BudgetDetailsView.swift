import SwiftUI

struct BudgetDetailsView: View {
    let budgetId: String
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var showAddBudgetLine = false
    @State private var linkedTransactionsContext: LinkedTransactionsContext?
    @State private var selectedBudgetLineForEdit: BudgetLine?
    @State private var selectedTransactionForEdit: Transaction?

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
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddBudgetLine = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            await viewModel.loadDetails()
        }
        .sheet(item: $selectedLineForTransaction) { line in
            AddAllocatedTransactionSheet(budgetLine: line) { transaction in
                viewModel.addTransaction(transaction)
            }
        }
        .sheet(isPresented: $showAddBudgetLine) {
            AddBudgetLineSheet(budgetId: budgetId) { budgetLine in
                viewModel.addBudgetLine(budgetLine)
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
    }

    private var content: some View {
        List {
            // Hero balance card (Revolut-style)
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    onTapProgress: {}
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            // Income section
            if !viewModel.incomeLines.isEmpty {
                BudgetSection(
                    title: "Revenus",
                    items: viewModel.incomeLines,
                    transactions: viewModel.transactions,
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

            // Expense section
            if !viewModel.expenseLines.isEmpty {
                BudgetSection(
                    title: "Dépenses",
                    items: viewModel.expenseLines,
                    transactions: viewModel.transactions,
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

            // Saving section
            if !viewModel.savingLines.isEmpty {
                BudgetSection(
                    title: "Épargne",
                    items: viewModel.savingLines,
                    transactions: viewModel.transactions,
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
                    title: "Transactions libres",
                    transactions: viewModel.freeTransactions,
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
        .applyScrollEdgeEffect()
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

    @MainActor
    func addBudgetLine(_ budgetLine: BudgetLine) {
        budgetLines.append(budgetLine)
    }

    @MainActor
    func deleteBudgetLine(_ line: BudgetLine) async {
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

        // Optimistic update
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
        }

        // Reload to sync with server
        await loadDetails()
    }

    @MainActor
    func updateTransaction(_ transaction: Transaction) async {
        // Optimistic update
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
        }

        // Reload to sync with server
        await loadDetails()
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
