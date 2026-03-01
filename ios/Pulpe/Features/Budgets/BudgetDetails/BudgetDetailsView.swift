import SwiftUI
import TipKit

private struct PreviousBudgetItem: Identifiable {
    let id: String
}

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var showAddBudgetLine = false
    @State private var linkedTransactionsContext: LinkedTransactionsContext?
    @State private var selectedBudgetLineForEdit: BudgetLine?
    @State private var selectedTransactionForEdit: Transaction?
    @State private var previousBudgetItem: PreviousBudgetItem?

    @State private var searchText = ""

    init(budgetId: String) {
        self.budgetId = budgetId
        self._viewModel = State(initialValue: BudgetDetailsViewModel(budgetId: budgetId))
    }

    private var timeElapsedPercentage: Double {
        guard let budget = viewModel.budget else { return 0 }
        return BudgetPeriodCalculator.timeElapsedPercentage(
            month: budget.month,
            year: budget.year,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    private var checkedFilterBinding: Binding<CheckedFilterOption> {
        let vm = viewModel
        return Binding(
            get: { vm.checkedFilter },
            set: { vm.setCheckedFilter($0) }
        )
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.budget == nil {
                BudgetDetailsSkeletonView()
                    .transition(.opacity)
            } else if let error = viewModel.error, viewModel.budget == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
                .transition(.opacity)
            } else if viewModel.budget != nil {
                content
                    .transition(.opacity)
            }
        }
        .trackScreen("BudgetDetails")
        .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.isLoading)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                MonthDropdownMenu(
                    budgets: viewModel.allBudgets,
                    currentBudgetId: viewModel.budgetId,
                    currentMonthYear: viewModel.budget?.monthYear ?? "Budget",
                    onSelect: { viewModel.prepareNavigation(to: $0) }
                )
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddBudgetLine = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Ajouter une prévision")
            }
        }
        .task(id: viewModel.budgetId) {
            if viewModel.allBudgets.isEmpty {
                await viewModel.loadDetails()
            } else {
                await viewModel.reloadCurrentBudget()
            }
        }
        .sheet(item: $selectedLineForTransaction) { line in
            AddAllocatedTransactionSheet(budgetLine: line) { transaction in
                viewModel.addTransaction(transaction)
            }
        }
        .sheet(isPresented: $showAddBudgetLine) {
            AddBudgetLineSheet(budgetId: viewModel.budgetId) { budgetLine in
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
                onEdit: { transaction in
                    linkedTransactionsContext = nil
                    selectedTransactionForEdit = transaction
                },
                onDelete: { transaction in
                    linkedTransactionsContext = nil // Dismiss sheet first
                    viewModel.softDeleteTransaction(transaction, toastManager: appState.toastManager)
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
        .sheet(item: $previousBudgetItem) { item in
            PreviousBudgetSheet(budgetId: item.id)
        }
        .alert(
            "Pointer les transactions ?",
            isPresented: $viewModel.showCheckAllTransactionsAlert,
            presenting: viewModel.budgetLineToCheckAll
        ) { line in
            Button("Non, juste l'enveloppe", role: .cancel) {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: false)
                    if succeeded {
                        viewModel.showEnvelopeToastIfNeeded(for: line, toastManager: appState.toastManager)
                    }
                }
            }
            Button("Oui, tout pointer") {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: true)
                    if succeeded {
                        viewModel.showEnvelopeToastIfNeeded(for: line, toastManager: appState.toastManager)
                    }
                }
            }
        } message: { _ in
            Text("Des transactions non pointées sont liées à cette enveloppe.")
        }
    }

    private var content: some View {
        // Apply both checked filter and search filter
        let filteredIncome = viewModel.filteredLines(viewModel.filteredIncomeLines, searchText: searchText)
        let filteredExpenses = viewModel.filteredLines(viewModel.filteredExpenseLines, searchText: searchText)
        let filteredSavings = viewModel.filteredLines(viewModel.filteredSavingLines, searchText: searchText)
        let filteredFree = viewModel.combinedFilteredFreeTransactions(searchText: searchText)

        let fullWidthInsets = EdgeInsets()

        return List {
            // Filter picker
            Section {
                CheckedFilterPicker(selection: checkedFilterBinding)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(fullWidthInsets)

            // Hero balance card
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    timeElapsedPercentage: timeElapsedPercentage
                )
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(fullWidthInsets)

            // Rollover section (toujours en premier)
            if let rolloverInfo = viewModel.rolloverInfo {
                RolloverInfoRow(
                    amount: rolloverInfo.amount,
                    onTap: rolloverInfo.previousBudgetId.map { id in
                        { previousBudgetItem = PreviousBudgetItem(id: id) }
                    }
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(fullWidthInsets)
            }

            // Empty search state
            if !searchText.isEmpty && filteredIncome.isEmpty && filteredExpenses.isEmpty &&
                filteredSavings.isEmpty && filteredFree.isEmpty {
                ContentUnavailableView("Aucune prévision trouvée", systemImage: "magnifyingglass")
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            // Budget line sections (tip appears in the first visible section)
            if !filteredIncome.isEmpty {
                budgetSection(title: "Revenus", items: filteredIncome, tip: ProductTips.gestures)
            }
            if !filteredExpenses.isEmpty {
                budgetSection(title: "Dépenses", items: filteredExpenses,
                              tip: filteredIncome.isEmpty ? ProductTips.gestures : nil)
            }
            if !filteredSavings.isEmpty {
                budgetSection(title: "Épargne", items: filteredSavings,
                              tip: filteredIncome.isEmpty && filteredExpenses.isEmpty ? ProductTips.gestures : nil)
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
                        viewModel.softDeleteTransaction(transaction, toastManager: appState.toastManager)
                    },
                    onEdit: { transaction in
                        selectedTransactionForEdit = transaction
                    }
                )
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(DesignTokens.Spacing.xxl)
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .refreshable {
            await viewModel.loadDetails(force: true)
        }
        .searchable(text: $searchText, prompt: "Rechercher...")
    }

    // MARK: - Section Builders

    private func budgetSection(title: String, items: [BudgetLine], tip: (any Tip)? = nil) -> some View {
        BudgetSection(
            title: title,
            items: items,
            transactions: viewModel.transactions,
            syncingIds: viewModel.syncingBudgetLineIds,
            onToggle: { line in
                Task {
                    let succeeded = await viewModel.toggleBudgetLine(line)
                    if succeeded {
                        viewModel.showEnvelopeToastIfNeeded(for: line, toastManager: appState.toastManager)
                    }
                }
            },
            onDelete: { line in
                viewModel.softDeleteBudgetLine(line, toastManager: appState.toastManager)
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
                guard !line.isManuallyAdjusted else {
                    appState.toastManager.show(
                        "Cette ligne ajustée manuellement ne peut pas être modifiée",
                        type: .error
                    )
                    return
                }
                selectedBudgetLineForEdit = line
            },
            tip: tip
        )
    }
}

private struct BudgetDetailsSkeletonView: View {
    var body: some View {
        List {
            // Filter picker placeholder
            Section {
                SkeletonShape(height: 32, cornerRadius: DesignTokens.CornerRadius.sm)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(EdgeInsets())

            // Hero card placeholder
            Section {
                SkeletonShape(height: 200, cornerRadius: DesignTokens.CornerRadius.xl)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(EdgeInsets())

            // Budget line sections (Revenus + Dépenses)
            ForEach(0..<2, id: \.self) { _ in
                Section {
                    ForEach(0..<3, id: \.self) { _ in
                        HStack {
                            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                                SkeletonShape(width: 120, height: 14)
                                SkeletonShape(width: 80, height: 11)
                            }
                            Spacer()
                            SkeletonShape(width: 70, height: 14)
                        }
                    }
                } header: {
                    SkeletonShape(width: 80, height: 14)
                }
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(DesignTokens.Spacing.lg)
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du budget")
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
    .environment(AppState())
    .environment(UserSettingsStore())
}
#Preview("Gestures Tip") {
    List {
        Section("Dépenses") {
            TipView(ProductTips.gestures)
            Text("Courses alimentaires")
        }
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
    .task { try? Tips.resetDatastore() }
}
