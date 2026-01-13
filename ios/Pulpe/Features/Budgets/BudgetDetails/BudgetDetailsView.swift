import SwiftUI

// MARK: - Month Navigation Bar

struct MonthNavigationBar: View {
    let monthYear: String
    let hasPrevious: Bool
    let hasNext: Bool
    let onPrevious: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onPrevious()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(hasPrevious ? .primary : .tertiary)
            }
            .disabled(!hasPrevious)

            Text(monthYear)
                .font(.headline)
                .lineLimit(1)

            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onNext()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(hasNext ? .primary : .tertiary)
            }
            .disabled(!hasNext)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .modifier(GlassBackgroundModifier())
    }
}

// MARK: - Glass Background Modifier

private struct GlassBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(in: .capsule)
        } else {
            content.background(.ultraThinMaterial, in: Capsule())
        }
    }
}

struct BudgetDetailsView: View {
    let budgetId: String
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var showAddBudgetLine = false
    @State private var linkedTransactionsContext: LinkedTransactionsContext?
    @State private var selectedBudgetLineForEdit: BudgetLine?
    @State private var selectedTransactionForEdit: Transaction?
    @State private var searchText = ""
    @State private var slideFromEdge: Edge = .trailing

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
                    .id(viewModel.budgetId)
                    .transition(.push(from: slideFromEdge))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                MonthNavigationBar(
                    monthYear: viewModel.budget?.monthYear ?? "Budget",
                    hasPrevious: viewModel.hasPreviousBudget,
                    hasNext: viewModel.hasNextBudget,
                    onPrevious: navigateToPreviousMonth,
                    onNext: navigateToNextMonth
                )
            }
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

    // MARK: - Navigation

    private func navigateToPreviousMonth() {
        guard let previousId = viewModel.previousBudgetId else { return }
        slideFromEdge = .leading
        withAnimation(.easeInOut(duration: 0.25)) {
            viewModel.prepareNavigation(to: previousId)
        }
        Task {
            await viewModel.reloadCurrentBudget()
        }
    }

    private func navigateToNextMonth() {
        guard let nextId = viewModel.nextBudgetId else { return }
        slideFromEdge = .trailing
        withAnimation(.easeInOut(duration: 0.25)) {
            viewModel.prepareNavigation(to: nextId)
        }
        Task {
            await viewModel.reloadCurrentBudget()
        }
    }

    private var content: some View {
        let filteredIncome = viewModel.filteredLines(viewModel.incomeLines, searchText: searchText)
        let filteredExpenses = viewModel.filteredLines(viewModel.expenseLines, searchText: searchText)
        let filteredSavings = viewModel.filteredLines(viewModel.savingLines, searchText: searchText)
        let filteredFree = viewModel.filteredFreeTransactions(searchText: searchText)

        return List {
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
            if !filteredIncome.isEmpty {
                BudgetSection(
                    title: "Revenus",
                    items: filteredIncome,
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

            // Expense section
            if !filteredExpenses.isEmpty {
                BudgetSection(
                    title: "Dépenses",
                    items: filteredExpenses,
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

            // Saving section
            if !filteredSavings.isEmpty {
                BudgetSection(
                    title: "Épargne",
                    items: filteredSavings,
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
            if !filteredFree.isEmpty {
                TransactionSection(
                    title: "Transactions libres",
                    transactions: filteredFree,
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
        .applyScrollEdgeEffect()
        .refreshable {
            await viewModel.loadDetails()
        }
        .searchable(text: $searchText, prompt: "Rechercher...")
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class BudgetDetailsViewModel {
    private(set) var budgetId: String

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    // Track IDs of items currently syncing for visual feedback
    private(set) var syncingBudgetLineIds: Set<String> = []
    private(set) var syncingTransactionIds: Set<String> = []

    // Navigation between months
    private(set) var allBudgets: [Budget] = []
    private(set) var previousBudgetId: String?
    private(set) var nextBudgetId: String?

    private let budgetService = BudgetService.shared
    private let budgetLineService = BudgetLineService.shared
    private let transactionService = TransactionService.shared

    init(budgetId: String) {
        self.budgetId = budgetId
    }

    var hasPreviousBudget: Bool { previousBudgetId != nil }
    var hasNextBudget: Bool { nextBudgetId != nil }

    /// Prepare navigation by changing the budgetId (synchronous, can be animated)
    func prepareNavigation(to id: String) {
        budgetId = id
    }

    var metrics: BudgetFormulas.Metrics {
        BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    var incomeLines: [BudgetLine] {
        budgetLines
            .filter { $0.kind == .income }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var expenseLines: [BudgetLine] {
        budgetLines
            .filter { $0.kind == .expense }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var savingLines: [BudgetLine] {
        budgetLines
            .filter { $0.kind == .saving }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var freeTransactions: [Transaction] {
        transactions
            .filter { $0.budgetLineId == nil }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    /// Filters budget lines by name or by linked transaction names (accent and case insensitive)
    func filteredLines(_ lines: [BudgetLine], searchText: String) -> [BudgetLine] {
        guard !searchText.isEmpty else { return lines }
        return lines.filter { line in
            line.name.localizedStandardContains(searchText) ||
                transactions.contains {
                    $0.budgetLineId == line.id &&
                        $0.name.localizedStandardContains(searchText)
                }
        }
    }

    /// Filters free transactions by name (accent and case insensitive)
    func filteredFreeTransactions(searchText: String) -> [Transaction] {
        guard !searchText.isEmpty else { return freeTransactions }
        return freeTransactions.filter {
            $0.name.localizedStandardContains(searchText)
        }
    }

    /// Full load: fetches budget details AND all budgets list (for month navigation)
    /// Use for: initial load, pull-to-refresh
    @MainActor
    func loadDetails() async {
        isLoading = true
        error = nil

        do {
            async let detailsTask = budgetService.getBudgetWithDetails(id: budgetId)
            async let budgetsTask = budgetService.getAllBudgets()

            let (details, budgets) = try await (detailsTask, budgetsTask)

            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
            allBudgets = budgets

            updateAdjacentBudgets()
        } catch {
            self.error = error
        }

        isLoading = false
    }

    /// Light reload: fetches only current budget details (no allBudgets)
    /// Use for: after toggle, update, or month navigation
    @MainActor
    func reloadCurrentBudget() async {
        error = nil

        do {
            let details = try await budgetService.getBudgetWithDetails(id: budgetId)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
            updateAdjacentBudgets()
        } catch {
            self.error = error
        }
    }

    private func updateAdjacentBudgets() {
        guard let currentBudget = budget else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        // Sort budgets chronologically
        let sorted = allBudgets.sorted { lhs, rhs in
            if lhs.year != rhs.year { return lhs.year < rhs.year }
            return lhs.month < rhs.month
        }

        guard let currentIndex = sorted.firstIndex(where: { $0.id == currentBudget.id }) else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        previousBudgetId = currentIndex > 0 ? sorted[currentIndex - 1].id : nil
        nextBudgetId = currentIndex < sorted.count - 1 ? sorted[currentIndex + 1].id : nil
    }

    @MainActor
    func toggleBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }
        guard !syncingBudgetLineIds.contains(line.id) else { return }

        syncingBudgetLineIds.insert(line.id)

        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            await reloadCurrentBudget()
        } catch {
            budgetLines = originalLines
            self.error = error
        }

        syncingBudgetLineIds.remove(line.id)
    }

    @MainActor
    func toggleTransaction(_ transaction: Transaction) async {
        guard !syncingTransactionIds.contains(transaction.id) else { return }

        syncingTransactionIds.insert(transaction.id)

        let originalTransactions = transactions
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction.toggled()
        }

        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            await reloadCurrentBudget()
        } catch {
            transactions = originalTransactions
            self.error = error
        }

        syncingTransactionIds.remove(transaction.id)
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
        await reloadCurrentBudget()
    }

    @MainActor
    func updateTransaction(_ transaction: Transaction) async {
        // Optimistic update
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
        }

        // Reload to sync with server
        await reloadCurrentBudget()
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
