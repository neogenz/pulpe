import SwiftUI

// MARK: - Month Dropdown Menu

struct MonthDropdownMenu: View {
    let budgets: [BudgetSparse]
    let currentBudgetId: String
    let currentMonthYear: String
    let onSelect: (String) -> Void

    @State private var selectionTrigger = false

    var body: some View {
        Menu {
            pickerContent
        } label: {
            labelContent
        }
        .sensoryFeedback(.selection, trigger: selectionTrigger)
        .accessibilityLabel("Sélectionner un mois")
        .onChange(of: currentBudgetId) { selectionTrigger.toggle() }
    }

    private var pickerContent: some View {
        Picker("", selection: Binding(
            get: { currentBudgetId },
            set: { id in
                guard id != currentBudgetId else { return }
                onSelect(id)
            }
        )) {
            ForEach(currentYearBudgets) { budget in
                Text(monthLabel(for: budget))
                    .tag(budget.id)
            }
        }
    }

    private var labelContent: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(currentMonthYear)
                .font(.headline)
                .lineLimit(1)
            Image(systemName: "chevron.up.chevron.down")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 10)
        .modifier(GlassBackgroundModifier())
    }

    private var currentYear: Int? {
        budgets.first(where: { $0.id == currentBudgetId })?.year
    }

    private var currentYearBudgets: [BudgetSparse] {
        guard let year = currentYear else { return [] }
        return budgets
            .filter { $0.year == year && $0.month != nil }
            .sorted { ($0.month ?? 0) < ($1.month ?? 0) }
    }

    private func monthLabel(for budget: BudgetSparse) -> String {
        guard let month = budget.month, let year = budget.year else { return "—" }
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        guard let date = Calendar.current.date(from: components) else {
            return "\(month)"
        }
        return Formatters.month.string(from: date).capitalized
    }
}

// MARK: - Glass Background Modifier

private struct GlassBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.glassEffect(in: .capsule)
        } else {
            content.background(.ultraThinMaterial, in: Capsule())
        }
        #else
        content.background(.ultraThinMaterial, in: Capsule())
        #endif
    }
}

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
        .onChange(of: budgetId) { _, newId in
            if viewModel.budgetId != newId {
                viewModel.prepareNavigation(to: newId)
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
        .alert(
            "Comptabiliser les transactions ?",
            isPresented: $viewModel.showCheckAllTransactionsAlert,
            presenting: viewModel.budgetLineToCheckAll
        ) { line in
            Button("Non, juste l'enveloppe", role: .cancel) {
                Task {
                    guard let toastManager = viewModel.toastManagerForCheckAll else { return }
                    let succeeded = await viewModel.performToggleBudgetLine(line)
                    if succeeded {
                        viewModel.showEnvelopeToastIfNeeded(for: line, toastManager: toastManager)
                    }
                    viewModel.budgetLineToCheckAll = nil
                    viewModel.toastManagerForCheckAll = nil
                }
            }
            Button("Oui, tout comptabiliser") {
                Task {
                    guard let toastManager = viewModel.toastManagerForCheckAll else { return }
                    let succeeded = await viewModel.performToggleBudgetLine(line)
                    if succeeded {
                        await viewModel.checkAllAllocatedTransactions(for: line.id)
                        viewModel.showEnvelopeToastIfNeeded(for: line, toastManager: toastManager)
                    }
                    viewModel.budgetLineToCheckAll = nil
                    viewModel.toastManagerForCheckAll = nil
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
        let filteredFree = viewModel.filteredFreeTransactions(searchText: searchText)
            .filter { tx in
                // Also apply checked filter to free transactions
                !viewModel.isShowingOnlyUnchecked || tx.checkedAt == nil
            }

        let fullWidthInsets = EdgeInsets()

        return List {
            // Filter picker
            Section {
                CheckedFilterPicker(selection: $viewModel.checkedFilter)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)
            .listRowInsets(fullWidthInsets)

            // Hero balance card
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    onTapProgress: {}
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
                        { appState.budgetPath.append(BudgetDestination.details(budgetId: id)) }
                    }
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(fullWidthInsets)
            }

            // Empty search state
            if !searchText.isEmpty && filteredIncome.isEmpty && filteredExpenses.isEmpty && filteredSavings.isEmpty && filteredFree.isEmpty {
                ContentUnavailableView("Aucune prévision trouvée", systemImage: "magnifyingglass")
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            // Budget line sections (income, expenses, savings)
            ForEach(
                [("Revenus", filteredIncome), ("Dépenses", filteredExpenses), ("Épargne", filteredSavings)],
                id: \.0
            ) { title, items in
                if !items.isEmpty {
                    BudgetSection(
                        title: title,
                        items: items,
                        transactions: viewModel.transactions,
                        syncingIds: viewModel.syncingBudgetLineIds,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line, toastManager: appState.toastManager) }
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
        .listSectionSpacing(DesignTokens.Spacing.lg)
        .scrollContentBackground(.hidden)
        .pulpeStatusBackground(isDeficit: viewModel.metrics.isDeficit)
        .refreshable {
            await viewModel.loadDetails()
        }
        .searchable(text: $searchText, prompt: "Rechercher...")
    }
}

// MARK: - ViewModel

// MARK: - UserDefaults Key

private enum BudgetDetailsUserDefaultsKey {
    static let showOnlyUnchecked = "pulpe-budget-show-only-unchecked"
}

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

    // Alert state for checking all transactions when toggling an envelope
    var showCheckAllTransactionsAlert = false
    var budgetLineToCheckAll: BudgetLine?
    var toastManagerForCheckAll: ToastManager?

    // Navigation between months
    private(set) var allBudgets: [BudgetSparse] = []
    private(set) var previousBudgetId: String?
    private(set) var nextBudgetId: String?

    // Filter state - persisted to UserDefaults
    var checkedFilter: CheckedFilterOption {
        didSet {
            UserDefaults.standard.set(
                checkedFilter == .unchecked,
                forKey: BudgetDetailsUserDefaultsKey.showOnlyUnchecked
            )
        }
    }

    var isShowingOnlyUnchecked: Bool { checkedFilter == .unchecked }

    private let budgetService = BudgetService.shared
    private let budgetLineService = BudgetLineService.shared
    private let transactionService = TransactionService.shared
    init(budgetId: String) {
        self.budgetId = budgetId
        // Load persisted filter preference (default: show only unchecked)
        let showOnlyUnchecked = UserDefaults.standard.object(forKey: BudgetDetailsUserDefaultsKey.showOnlyUnchecked) as? Bool ?? true
        self.checkedFilter = showOnlyUnchecked ? .unchecked : .all
    }

    var hasPreviousBudget: Bool { previousBudgetId != nil }
    var hasNextBudget: Bool { nextBudgetId != nil }

    /// Prepare navigation by changing the budgetId (synchronous)
    /// Old data stays as placeholder until new data arrives via reloadCurrentBudget()
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

    // MARK: - Filtered Lines (based on checked filter)

    /// Filters budget lines based on the checked filter preference
    private func applyCheckedFilter(_ lines: [BudgetLine]) -> [BudgetLine] {
        guard isShowingOnlyUnchecked else { return lines }
        return lines.filter { $0.checkedAt == nil }
    }

    /// Filters free transactions based on the checked filter preference
    private func applyCheckedFilterToFreeTransactions(_ transactions: [Transaction]) -> [Transaction] {
        guard isShowingOnlyUnchecked else { return transactions }
        return transactions.filter { $0.checkedAt == nil }
    }

    var filteredIncomeLines: [BudgetLine] {
        applyCheckedFilter(incomeLines)
    }

    var filteredExpenseLines: [BudgetLine] {
        applyCheckedFilter(expenseLines)
    }

    var filteredSavingLines: [BudgetLine] {
        applyCheckedFilter(savingLines)
    }

    var filteredFreeTransactionsForDisplay: [Transaction] {
        applyCheckedFilterToFreeTransactions(freeTransactions)
    }

    var rolloverInfo: (amount: Decimal, previousBudgetId: String?)? {
        guard let budget, let rollover = budget.rollover, rollover != 0 else {
            return nil
        }
        return (amount: rollover, previousBudgetId: budget.previousBudgetId)
    }

    /// Filters budget lines by name or by linked transaction names (accent and case insensitive)
    func filteredLines(_ lines: [BudgetLine], searchText: String) -> [BudgetLine] {
        guard !searchText.isEmpty else { return lines }
        return lines.filter { line in
            line.name.localizedStandardContains(searchText) ||
                "\(line.amount)".contains(searchText) ||
                transactions.contains {
                    $0.budgetLineId == line.id &&
                        ($0.name.localizedStandardContains(searchText) ||
                         "\($0.amount)".contains(searchText))
                }
        }
    }

    /// Filters free transactions by name (accent and case insensitive)
    func filteredFreeTransactions(searchText: String) -> [Transaction] {
        guard !searchText.isEmpty else { return freeTransactions }
        return freeTransactions.filter {
            $0.name.localizedStandardContains(searchText) ||
                "\($0.amount)".contains(searchText)
        }
    }

    /// Full load: fetches budget details AND all budgets list (for month navigation)
    /// Use for: initial load, pull-to-refresh
    func loadDetails() async {
        isLoading = true
        error = nil

        do {
            async let detailsTask = budgetService.getBudgetWithDetails(id: budgetId)
            async let budgetsTask = budgetService.getBudgetsSparse(fields: "month,year")

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
    func reloadCurrentBudget() async {
        isLoading = budget == nil
        error = nil
        defer { isLoading = false }

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
            let lhsYear = lhs.year ?? 0
            let rhsYear = rhs.year ?? 0
            if lhsYear != rhsYear { return lhsYear < rhsYear }
            return (lhs.month ?? 0) < (rhs.month ?? 0)
        }

        guard let currentIndex = sorted.firstIndex(where: { $0.id == currentBudget.id }) else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        previousBudgetId = currentIndex > 0 ? sorted[currentIndex - 1].id : nil
        nextBudgetId = currentIndex < sorted.count - 1 ? sorted[currentIndex + 1].id : nil
    }

    func toggleBudgetLine(_ line: BudgetLine, toastManager: ToastManager) async {
        guard !(line.isRollover ?? false) else { return }
        guard !syncingBudgetLineIds.contains(line.id) else { return }

        let wasUnchecked = !line.isChecked

        // If checking and there are unchecked transactions, show alert
        if wasUnchecked {
            let uncheckedTransactions = transactions.filter {
                $0.budgetLineId == line.id && !$0.isChecked
            }
            if !uncheckedTransactions.isEmpty {
                budgetLineToCheckAll = line
                toastManagerForCheckAll = toastManager
                showCheckAllTransactionsAlert = true
                return
            }
        }

        let succeeded = await performToggleBudgetLine(line)
        if succeeded {
            showEnvelopeToastIfNeeded(for: line, toastManager: toastManager)
        }
    }

    @discardableResult
    func performToggleBudgetLine(_ line: BudgetLine) async -> Bool {
        guard !syncingBudgetLineIds.contains(line.id) else { return false }

        syncingBudgetLineIds.insert(line.id)
        defer { syncingBudgetLineIds.remove(line.id) }

        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            await reloadCurrentBudget()
            return true
        } catch {
            budgetLines = originalLines
            self.error = error
            return false
        }
    }

    func showEnvelopeToastIfNeeded(for line: BudgetLine, toastManager: ToastManager) {
        guard !line.isChecked, line.kind.isOutflow else { return }

        let consumed = transactions
            .filter { $0.budgetLineId == line.id && $0.isChecked && $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }
        let effective = max(line.amount, consumed)
        guard effective > consumed, consumed > 0 else { return }
        toastManager.show("Comptabilisé \(effective.asCHF) (enveloppe)")
    }

    func checkAllAllocatedTransactions(for budgetLineId: String) async {
        let unchecked = transactions.filter {
            $0.budgetLineId == budgetLineId && !$0.isChecked
        }
        for tx in unchecked {
            await toggleTransaction(tx)
        }
    }

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

    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
    }

    func addBudgetLine(_ budgetLine: BudgetLine) {
        budgetLines.append(budgetLine)
    }

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

    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        // Optimistic update
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
        }

        // Reload to sync with server
        await reloadCurrentBudget()
    }

    func updateTransaction(_ transaction: Transaction) async {
        // Optimistic update
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
        }

        // Reload to sync with server
        await reloadCurrentBudget()
    }
}

// MARK: - Rollover Info Row

private struct RolloverInfoRow: View {
    let amount: Decimal
    let onTap: (() -> Void)?

    private var isPositive: Bool { amount >= 0 }

    @ViewBuilder
    var body: some View {
        if let onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var content: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "arrow.uturn.backward.circle.fill")
                .font(.title2)
                .foregroundStyle(isPositive ? Color.financialSavings : Color.financialOverBudget)

            VStack(alignment: .leading, spacing: 2) {
                Text("Report du mois précédent")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)
                Text(isPositive ? "Excédent reporté" : "Déficit reporté")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(amount.asCHF)
                .font(.headline)
                .fontWeight(.semibold)
                .foregroundStyle(isPositive ? Color.financialSavings : Color.financialOverBudget)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill((isPositive ? Color.financialSavings : Color.financialOverBudget).opacity(DesignTokens.Opacity.highlightBackground))
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Report du mois précédent")
        .accessibilityValue("\(isPositive ? "Excédent" : "Déficit") de \(amount.asCHF)")
        .ifLet(onTap) { view, _ in
            view.accessibilityHint("Appuie deux fois pour voir le budget précédent")
        }
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
