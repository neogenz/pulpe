import SwiftUI

// MARK: - ViewModel

@Observable @MainActor
final class PreviousBudgetSheetViewModel {
    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    let budgetId: String
    private let budgetService = BudgetService.shared

    @ObservationIgnored private var cachedMetrics: BudgetFormulas.Metrics?

    init(budgetId: String) {
        self.budgetId = budgetId
    }

    init(budgetId: String, budget: Budget, budgetLines: [BudgetLine], transactions: [Transaction]) {
        self.budgetId = budgetId
        self.budget = budget
        self.budgetLines = budgetLines
        self.transactions = transactions
    }

    var metrics: BudgetFormulas.Metrics {
        if let cached = cachedMetrics { return cached }
        let calculated = BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
        cachedMetrics = calculated
        return calculated
    }

    var incomeLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .income }.sorted { $0.createdAt > $1.createdAt }
    }

    var expenseLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .expense }.sorted { $0.createdAt > $1.createdAt }
    }

    var savingLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .saving }.sorted { $0.createdAt > $1.createdAt }
    }

    var freeTransactions: [Transaction] {
        transactions.filter { $0.budgetLineId == nil }.sorted { $0.transactionDate > $1.transactionDate }
    }

    var rolloverInfo: (amount: Decimal, previousBudgetId: String?)? {
        guard let budget, let rollover = budget.rollover, rollover != 0 else { return nil }
        return (amount: rollover, previousBudgetId: budget.previousBudgetId)
    }

    func loadDetails() async {
        isLoading = true
        error = nil

        do {
            let details = try await budgetService.getBudgetWithDetails(id: budgetId)
            cachedMetrics = nil
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
        } catch {
            self.error = error
        }

        isLoading = false
    }
}

// MARK: - View

struct PreviousBudgetSheet: View {
    @State private var viewModel: PreviousBudgetSheetViewModel
    @State private var detent: PresentationDetent = .large
    @Environment(\.dismiss) private var dismiss

    init(budgetId: String) {
        self._viewModel = State(initialValue: PreviousBudgetSheetViewModel(budgetId: budgetId))
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.budget == nil {
                    LoadingView(message: "Chargement...")
                } else if let error = viewModel.error, viewModel.budget == nil {
                    ErrorView(error: error) {
                        await viewModel.loadDetails()
                    }
                } else if viewModel.budget != nil {
                    content
                } else {
                    LoadingView(message: "Chargement...")
                }
            }
            .navigationTitle(viewModel.budget?.monthYear ?? "Budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .task { await viewModel.loadDetails() }
    }

    private var content: some View {
        List {
            heroSection
            rolloverSection
            budgetLineSections
            freeTransactionsSection
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(DesignTokens.Spacing.lg)
        .scrollContentBackground(.hidden)
    }

    private var heroSection: some View {
        Section {
            HeroBalanceCard(
                metrics: viewModel.metrics,
                onTapProgress: {}
            )
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .listSectionSeparator(.hidden)
        .listRowInsets(EdgeInsets())
    }

    @ViewBuilder
    private var rolloverSection: some View {
        if let rolloverInfo = viewModel.rolloverInfo {
            RolloverInfoRow(
                amount: rolloverInfo.amount,
                onTap: nil
            )
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets())
        }
    }

    @ViewBuilder
    private var budgetLineSections: some View {
        let income = viewModel.incomeLines
        let expenses = viewModel.expenseLines
        let savings = viewModel.savingLines

        if !income.isEmpty {
            BudgetSection(
                title: "Revenus",
                items: income,
                transactions: viewModel.transactions,
                syncingIds: []
            )
        }

        if !expenses.isEmpty {
            BudgetSection(
                title: "Dépenses",
                items: expenses,
                transactions: viewModel.transactions,
                syncingIds: []
            )
        }

        if !savings.isEmpty {
            BudgetSection(
                title: "Épargne",
                items: savings,
                transactions: viewModel.transactions,
                syncingIds: []
            )
        }
    }

    @ViewBuilder
    private var freeTransactionsSection: some View {
        let free = viewModel.freeTransactions
        if !free.isEmpty {
            TransactionSection(
                title: "Transactions libres",
                transactions: free,
                syncingIds: []
            )
        }
    }
}
