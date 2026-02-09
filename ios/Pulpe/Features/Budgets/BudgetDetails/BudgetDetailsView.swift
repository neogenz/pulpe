import SwiftUI

// MARK: - Month Navigation Bar

struct MonthNavigationBar: View {
    let monthYear: String
    let hasPrevious: Bool
    let hasNext: Bool
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onTapMonth: () -> Void

    @State private var navigateTrigger = false

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            Button {
                onPrevious()
                navigateTrigger.toggle()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(hasPrevious ? .primary : .tertiary)
            }
            .disabled(!hasPrevious)

            Button(action: onTapMonth) {
                Text(monthYear)
                    .font(.headline)
                    .lineLimit(1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Sélectionner un mois")

            Button {
                onNext()
                navigateTrigger.toggle()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(hasNext ? .primary : .tertiary)
            }
            .disabled(!hasNext)
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: navigateTrigger)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 10)
        .modifier(GlassBackgroundModifier())
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
    @State private var showMonthPicker = false
    @State private var searchText = ""
    @State private var contentOffset: CGFloat = 0
    @State private var contentOpacity: Double = 1

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
                    .offset(x: contentOffset)
                    .opacity(contentOpacity)
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
                    onNext: navigateToNextMonth,
                    onTapMonth: { showMonthPicker = true }
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
        .sheet(isPresented: $showMonthPicker) {
            MonthPickerSheet(
                budgets: viewModel.allBudgets,
                currentBudgetId: viewModel.budgetId,
                onSelect: { id in
                    navigateToMonth(id, forward: isForward(id))
                }
            )
        }
    }

    // MARK: - Navigation

    private func navigateToPreviousMonth() {
        guard let previousId = viewModel.previousBudgetId else { return }
        navigateToMonth(previousId, forward: false)
    }

    private func navigateToNextMonth() {
        guard let nextId = viewModel.nextBudgetId else { return }
        navigateToMonth(nextId, forward: true)
    }

    private func isForward(_ targetId: String) -> Bool {
        let sorted = viewModel.allBudgets.sorted { lhs, rhs in
            let lhsYear = lhs.year ?? 0
            let rhsYear = rhs.year ?? 0
            if lhsYear != rhsYear { return lhsYear < rhsYear }
            return (lhs.month ?? 0) < (rhs.month ?? 0)
        }
        guard let currentIndex = sorted.firstIndex(where: { $0.id == viewModel.budgetId }),
              let targetIndex = sorted.firstIndex(where: { $0.id == targetId }) else {
            return true
        }
        return targetIndex > currentIndex
    }

    private func navigateToMonth(_ id: String, forward: Bool) {
        let slideOutX: CGFloat = forward ? -40 : 40
        let slideInX: CGFloat = forward ? 40 : -40

        Task { @MainActor in
            // Phase 1: Slide out current content
            withAnimation(.easeIn(duration: 0.12)) {
                contentOffset = slideOutX
                contentOpacity = 0
            }
            try? await Task.sleep(for: .milliseconds(120))

            // Phase 2: Swap data while hidden
            viewModel.prepareNavigation(to: id)
            contentOffset = slideInX

            // Phase 3: Slide in new content
            withAnimation(.easeOut(duration: 0.2)) {
                contentOffset = 0
                contentOpacity = 1
            }
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

        return List {
            // Filter picker
            Section {
                CheckedFilterPicker(selection: $viewModel.checkedFilter)
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listSectionSeparator(.hidden)

            // Hero balance card - applyGlass: false car le List fournit son propre styling
            Section {
                HeroBalanceCard(
                    metrics: viewModel.metrics,
                    applyGlass: false,
                    onTapProgress: {}
                )
            }

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
        .pulpeBackground()
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
    private let toastManager: ToastManager

    init(budgetId: String, toastManager: ToastManager = AppState.shared.toastManager) {
        self.budgetId = budgetId
        self.toastManager = toastManager
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

    func toggleBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }
        guard !syncingBudgetLineIds.contains(line.id) else { return }

        let wasUnchecked = !line.isChecked
        syncingBudgetLineIds.insert(line.id)

        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            await reloadCurrentBudget()

            if wasUnchecked, line.kind.isOutflow {
                let consumed = transactions
                    .filter { $0.budgetLineId == line.id && $0.isChecked && $0.kind.isOutflow }
                    .reduce(Decimal.zero) { $0 + $1.amount }
                let effective = max(line.amount, consumed)
                if effective > consumed, consumed > 0 {
                    toastManager.show("Comptabilisé \(effective.asCHF) (enveloppe)")
                }
            }
        } catch {
            budgetLines = originalLines
            self.error = error
        }

        syncingBudgetLineIds.remove(line.id)
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

// MARK: - Month Picker Sheet

private struct MonthPickerSheet: View {
    let budgets: [BudgetSparse]
    let currentBudgetId: String
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectionTrigger = false

    private var budgetsByYear: [(year: Int, budgets: [BudgetSparse])] {
        let sorted = budgets
            .filter { $0.month != nil && $0.year != nil }
            .sorted { lhs, rhs in
                let lhsYear = lhs.year ?? 0
                let rhsYear = rhs.year ?? 0
                if lhsYear != rhsYear { return lhsYear < rhsYear }
                return (lhs.month ?? 0) < (rhs.month ?? 0)
            }
        let grouped = Dictionary(grouping: sorted) { $0.year ?? 0 }
        return grouped.keys.sorted().map { year in
            (year: year, budgets: grouped[year] ?? [])
        }
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    ForEach(budgetsByYear, id: \.year) { year, yearBudgets in
                        Section(String(year)) {
                            ForEach(yearBudgets) { budget in
                                monthRow(for: budget)
                            }
                        }
                    }
                }
                .onAppear {
                    proxy.scrollTo(currentBudgetId, anchor: .center)
                }
            }
            .navigationTitle("Choisir un mois")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sensoryFeedback(.selection, trigger: selectionTrigger)
    }

    private func monthRow(for budget: BudgetSparse) -> some View {
        let isCurrent = budget.id == currentBudgetId
        return Button {
            selectionTrigger.toggle()
            dismiss()
            onSelect(budget.id)
        } label: {
            HStack {
                Text(monthYearLabel(for: budget))
                    .foregroundStyle(.primary)
                Spacer()
                if isCurrent {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.pulpePrimary)
                        .fontWeight(.semibold)
                }
            }
        }
        .listRowBackground(isCurrent ? Color.pulpePrimary.opacity(0.1) : nil)
        .accessibilityAddTraits(isCurrent ? .isSelected : [])
        .id(budget.id)
    }

    private func monthYearLabel(for budget: BudgetSparse) -> String {
        guard let month = budget.month, let year = budget.year else { return "—" }
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        guard let date = Calendar.current.date(from: components) else {
            return "\(month)/\(year)"
        }
        return Formatters.monthYear.string(from: date).capitalized
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
