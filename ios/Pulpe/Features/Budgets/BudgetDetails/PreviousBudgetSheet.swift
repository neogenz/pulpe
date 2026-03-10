import SwiftUI

// MARK: - ViewModel

@Observable @MainActor
final class PreviousBudgetSheetViewModel {
    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading: Bool
    private(set) var error: Error?

    let budgetId: String
    private let budgetService = BudgetService.shared

    @ObservationIgnored private var cachedMetrics: BudgetFormulas.Metrics?

    init(budgetId: String) {
        self.budgetId = budgetId

        // Pre-populate from cache to avoid unnecessary network call
        if let cached = BudgetDetailCache.shared.get(budgetId: budgetId) {
            self.budget = cached.budget
            self.budgetLines = cached.budgetLines
            self.transactions = cached.transactions
            self.isLoading = false
            recomputeMetrics()
        } else {
            self.isLoading = true
        }
    }

    /// Init with pre-loaded data (used for testing and direct injection)
    init(budgetId: String, budget: Budget, budgetLines: [BudgetLine], transactions: [Transaction]) {
        self.budgetId = budgetId
        self.budget = budget
        self.budgetLines = budgetLines
        self.transactions = transactions
        self.isLoading = false
    }

    var metrics: BudgetFormulas.Metrics {
        cachedMetrics ?? BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    private func recomputeMetrics() {
        cachedMetrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    var incomeLines: [BudgetLine] { budgetLines.byKind(.income) }
    var expenseLines: [BudgetLine] { budgetLines.byKind(.expense) }
    var savingLines: [BudgetLine] { budgetLines.byKind(.saving) }
    var freeTransactions: [Transaction] { transactions.unallocated }

    var rolloverInfo: (amount: Decimal, previousBudgetId: String?)? {
        guard let budget, let rollover = budget.rollover, rollover != 0 else { return nil }
        return (amount: rollover, previousBudgetId: budget.previousBudgetId)
    }

    func loadDetails() async {
        // Skip fetch if cache already provided data
        guard budget == nil else { return }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let details = try await budgetService.getBudgetWithDetails(id: budgetId)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
            recomputeMetrics()
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            self.error = error
        }
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
        .presentationBackground(Color.sheetBackground)
        .task { await viewModel.loadDetails() }
    }

    private var content: some View {
        List {
            heroSection
            budgetLineSections
            freeTransactionsSection
        }
        .listStyle(.insetGrouped)
        .listRowSpacing(0)
        .listSectionSpacing(DesignTokens.Spacing.lg)
        .scrollContentBackground(.hidden)
        .pulpeBackground()
    }

    private var heroSection: some View {
        Section {
            HeroBalanceCard(
                metrics: viewModel.metrics,
                rolloverAmount: viewModel.rolloverInfo?.amount
            )
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .listSectionSeparator(.hidden)
        .listRowInsets(EdgeInsets())
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
