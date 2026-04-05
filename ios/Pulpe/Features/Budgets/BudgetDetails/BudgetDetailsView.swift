import SwiftUI
import TipKit

private struct PreviousBudgetItem: Identifiable {
    let id: String
}

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var showAddBudgetLine = false
    @State private var linkedBudgetLineId: IdentifiableString?
    @State private var selectedBudgetLineForEdit: BudgetLine?
    @State private var selectedTransactionForEdit: Transaction?
    @State private var previousBudgetItem: PreviousBudgetItem?
    @State private var showRealizedBalance = false

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
        .sheet(item: $linkedBudgetLineId) { idWrapper in
            LinkedTransactionsSheetWrapper(
                budgetLineId: idWrapper.value,
                viewModel: viewModel,
                onDismissAndEdit: { transaction in
                    linkedBudgetLineId = nil
                    selectedTransactionForEdit = transaction
                },
                onDismissAndDelete: { transaction in
                    linkedBudgetLineId = nil
                    viewModel.softDeleteTransaction(transaction, toastManager: appState.toastManager)
                },
                onDismissAndAddTransaction: { budgetLine in
                    linkedBudgetLineId = nil
                    selectedLineForTransaction = budgetLine
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
        .sheet(isPresented: $showRealizedBalance) {
            RealizedBalanceSheet(
                metrics: viewModel.metrics,
                realizedMetrics: viewModel.realizedMetrics
            )
        }
        .alert(
            "Pointer les transactions ?",
            isPresented: $viewModel.showCheckAllTransactionsAlert,
            presenting: viewModel.budgetLineToCheckAll
        ) { line in
            Button("Non, juste la prévision", role: .cancel) {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: false)
                    if succeeded {
                        viewModel.showCheckToastIfNeeded(
                            for: line, toastManager: appState.toastManager, amountsHidden: amountsHidden
                        )
                    }
                }
            }
            Button("Oui, tout pointer") {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: true)
                    if succeeded {
                        viewModel.showCheckToastIfNeeded(
                            for: line, toastManager: appState.toastManager, amountsHidden: amountsHidden
                        )
                    }
                }
            }
        } message: { _ in
            Text("Des transactions non pointées sont liées à cette prévision.")
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
            .listRowCustomStyled(insets: fullWidthInsets)
            .listSectionSeparator(.hidden)

            // Hero balance card (with integrated rollover)
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    timeElapsedPercentage: timeElapsedPercentage,
                    onTapChart: { showRealizedBalance = true },
                    rolloverAmount: viewModel.rolloverInfo?.amount,
                    onRolloverTap: viewModel.rolloverInfo?.previousBudgetId.map { id in
                        { previousBudgetItem = PreviousBudgetItem(id: id) }
                    }
                )
            }
            .listRowCustomStyled(insets: fullWidthInsets)
            .listSectionSeparator(.hidden)

            // Empty search state
            if !searchText.isEmpty && filteredIncome.isEmpty && filteredExpenses.isEmpty &&
                filteredSavings.isEmpty && filteredFree.isEmpty {
                ContentUnavailableView("Aucune prévision trouvée", systemImage: "magnifyingglass")
                    .listRowCustomStyled()
            }

            // All checked empty state (À pointer filter active, nothing left to check)
            if searchText.isEmpty && viewModel.isShowingOnlyUnchecked &&
                filteredIncome.isEmpty && filteredExpenses.isEmpty &&
                filteredSavings.isEmpty && filteredFree.isEmpty &&
                (!viewModel.budgetLines.isEmpty || !viewModel.transactions.isEmpty) {
                ContentUnavailableView {
                    Label("Tout est pointé", systemImage: "checkmark.circle.fill")
                } description: {
                    Text("Bien joué ! Passe sur « Tout voir » pour revoir tes prévisions.")
                }
                .listRowCustomStyled()
            }

            // Budget line sections (tip appears in the first visible section)
            if !filteredIncome.isEmpty {
                budgetSection(title: "Revenus", items: filteredIncome, tip: ProductTips.gestures)
            }
            if !filteredExpenses.isEmpty {
                budgetSection(title: "Dépenses", items: filteredExpenses,
                              tip: filteredIncome.isEmpty ? ProductTips.gestures : nil)

                Section {
                    TipView(ProductTips.pessimisticCheck)
                }
                .listRowCustomStyled(insets: EdgeInsets())
                .listSectionSeparator(.hidden)
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
        .listRowSpacing(0)
        .listSectionSpacing(DesignTokens.Spacing.xxl)
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .refreshable {
            await viewModel.loadDetails(force: true)
        }
        .searchable(
            text: $searchText,
            placement: .navigationBarDrawer(displayMode: .automatic),
            prompt: "Rechercher..."
        )
        .searchPresentationToolbarBehavior(.avoidHidingContent)
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
                        viewModel.showCheckToastIfNeeded(
                            for: line, toastManager: appState.toastManager, amountsHidden: amountsHidden
                        )
                    }
                }
            },
            onDelete: { line in
                viewModel.softDeleteBudgetLine(line, toastManager: appState.toastManager)
            },
            onAddTransaction: { line in
                selectedLineForTransaction = line
            },
            onLongPress: { line, _ in
                linkedBudgetLineId = IdentifiableString(value: line.id)
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

/// Thin Identifiable wrapper for `.sheet(item:)` with a plain String ID
private struct IdentifiableString: Identifiable {
    let value: String
    var id: String { value }
}

/// Reactive wrapper that reads budgetLine + transactions from the ViewModel
/// so SwiftUI re-renders when `toggleTransaction` mutates the @Observable store.
private struct LinkedTransactionsSheetWrapper: View {
    let budgetLineId: String
    let viewModel: BudgetDetailsViewModel
    let onDismissAndEdit: (Transaction) -> Void
    let onDismissAndDelete: (Transaction) -> Void
    let onDismissAndAddTransaction: (BudgetLine) -> Void

    private var budgetLine: BudgetLine? {
        viewModel.budgetLines.first { $0.id == budgetLineId }
    }

    private var transactions: [Transaction] {
        viewModel.transactions
            .filter { $0.budgetLineId == budgetLineId }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    var body: some View {
        if let budgetLine {
            LinkedTransactionsSheet(
                budgetLine: budgetLine,
                transactions: transactions,
                onToggle: { transaction in
                    Task { await viewModel.toggleTransaction(transaction) }
                },
                onEdit: { transaction in onDismissAndEdit(transaction) },
                onDelete: { transaction in onDismissAndDelete(transaction) },
                onAddTransaction: { onDismissAndAddTransaction(budgetLine) }
            )
        }
    }
}

private struct BudgetDetailsSkeletonView: View {
    var body: some View {
        List {
            // Filter picker placeholder
            Section {
                SkeletonShape(height: 32, cornerRadius: DesignTokens.CornerRadius.sm)
            }
            .listRowCustomStyled(insets: EdgeInsets())
            .listSectionSeparator(.hidden)

            // Hero card placeholder
            Section {
                SkeletonShape(height: 200, cornerRadius: DesignTokens.CornerRadius.xl)
            }
            .listRowCustomStyled(insets: EdgeInsets())
            .listSectionSeparator(.hidden)

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
