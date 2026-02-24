import SwiftUI

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) private var appState
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?
    @State private var showAddBudgetLine = false
    @State private var linkedTransactionsContext: LinkedTransactionsContext?
    @State private var selectedBudgetLineForEdit: BudgetLine?
    @State private var selectedTransactionForEdit: Transaction?

    @State private var searchText = ""

    init(budgetId: String) {
        self.budgetId = budgetId
        self._viewModel = State(initialValue: BudgetDetailsViewModel(budgetId: budgetId))
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
                LoadingView(message: "Chargement...")
            } else if let error = viewModel.error, viewModel.budget == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
            } else if viewModel.budget != nil {
                content
            }
        }
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
                onEdit: { transaction in
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
        .alert(
            "Comptabiliser les transactions ?",
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
            Button("Oui, tout comptabiliser") {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: true)
                    if succeeded {
                        viewModel.showEnvelopeToastIfNeeded(for: line, toastManager: appState.toastManager)
                    }
                }
            }
        } message: { _ in
            Text("Des transactions non comptabilisées sont liées à cette enveloppe.")
        }
    }

    private var content: some View {
        // Apply both checked filter and search filter
        let filteredIncome = viewModel.filteredLines(viewModel.filteredIncomeLines, searchText: searchText)
        let filteredExpenses = viewModel.filteredLines(viewModel.filteredExpenseLines, searchText: searchText)
        let filteredSavings = viewModel.filteredLines(viewModel.filteredSavingLines, searchText: searchText)
        let filteredFree = viewModel.combinedFilteredFreeTransactions(searchText: searchText)

        let fullWidthInsets = EdgeInsets()
        let heroCardInsets = EdgeInsets()

        return List {
            // Filter picker
            Section {
                CheckedFilterPicker(selection: checkedFilterBinding)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(fullWidthInsets)

            // Hero balance card (with horizontal padding to prevent edge clipping)
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    onTapProgress: {}
                )
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(heroCardInsets)

            // Rollover section (toujours en premier)
            if let rolloverInfo = viewModel.rolloverInfo {
                RolloverInfoRow(
                    amount: rolloverInfo.amount,
                    onTap: rolloverInfo.previousBudgetId.map { id in
                        { appState.budgetPath.append(BudgetDestination.details(budgetId: id)) }
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

            // Budget line sections
            if !filteredIncome.isEmpty {
                budgetSection(title: "Revenus", items: filteredIncome)
            }
            if !filteredExpenses.isEmpty {
                budgetSection(title: "Dépenses", items: filteredExpenses)
            }
            if !filteredSavings.isEmpty {
                budgetSection(title: "Épargne", items: filteredSavings)
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
        .listSectionSpacing(DesignTokens.Spacing.lg)
        .scrollContentBackground(.hidden)
        .pulpeStatusBackground(isDeficit: viewModel.metrics.isDeficit)
        .refreshable {
            await viewModel.loadDetails()
        }
        .searchable(text: $searchText, prompt: "Rechercher...")
    }

    // MARK: - Section Builders

    private func budgetSection(title: String, items: [BudgetLine]) -> some View {
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
            }
        )
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
