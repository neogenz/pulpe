import SwiftUI

/// Push detail page for a budget line (DM2.1.c spec).
///
/// Replaces the legacy bottom sheet (`BudgetLineDetailSheet`) with a full-page
/// drill-down inside the parent `NavigationStack`. The page reads its model
/// reactively from `BudgetDetailsViewModel` (injected via
/// `.environment(viewModel)` on the navigation destination), so external
/// mutations — sync, FX rate refresh, transaction toggle — flow back into the
/// view through Observation tracking.
///
/// Edits and additions push deeper into the same stack:
///   tap row     → push `BudgetLinePushRoute.editTx(transactionId:)`
///   tap "Ajouter" → push `BudgetLinePushRoute.addAllocatedTx(lineId:)`
///
/// Header menu actions:
///   "Modifier" → `onEditLine` callback (parent presents `editBudgetLine` sheet)
///   "Supprimer" → confirmation alert → `softDeleteBudgetLine` + automatic pop
///
/// When the underlying line is removed (deleted or filtered out by sync), the
/// page auto-pops via `dismiss()` from the empty branch — no stale state.
struct BudgetLineDetailPage: View {
    let lineId: String
    let onEditLine: (BudgetLine) -> Void

    @Environment(BudgetDetailsCoordinator.self) var coordinator
    @Environment(BudgetDetailsProjector.self) var projector
    @Environment(AppState.self) var appState
    @Environment(BudgetDetailsRouter.self) var router
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(\.dismiss) var dismiss

    @State private var showDeleteConfirmation = false

    // MARK: - Derived

    /// `first(where:)` returns a single element via direct iteration — it's
    /// not a collection-shaping op (unlike `filter`/`sorted`/`sort`/`map`),
    /// so the page stays compliant with the no-collection-ops rule.
    private var budgetLine: BudgetLine? {
        coordinator.dataStore.budgetLines.first { $0.id == lineId }
    }

    /// Transactions for this line are pre-grouped (newest first) by
    /// `BudgetDetailsProjector` once per source change. O(1) lookup, no
    /// per-body collection transform.
    private var transactions: [Transaction] {
        projector.screenState.transactionsByLineId[lineId] ?? []
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let line = budgetLine {
                pageContent(for: line, transactions: transactions)
            } else {
                // Line removed externally (delete commit, filter sync) →
                // auto-pop via shared helper after a grace period.
                AutoPopView { budgetLine == nil }
            }
        }
        .pulpeBackground()
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(budgetLine?.name ?? "")
    }

    @ViewBuilder
    private func pageContent(for line: BudgetLine, transactions: [Transaction]) -> some View {
        VStack(spacing: 0) {
            titleWithKindDot(line: line)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)

            transactionsList(line: line, transactions: transactions)
        }
        .pulpeStickyBottomCTA { addTransactionButton(line: line) }
        .hidesFloatingTabBar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                headerMenu(for: line)
            }
        }
        .alert(
            "Supprimer la prévision ?",
            isPresented: $showDeleteConfirmation,
            presenting: line
        ) { line in
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) {
                deleteBudgetLine(line)
            }
        } message: { _ in
            Text("Tu auras quelques secondes pour annuler.")
        }
        .accessibilityIdentifier("budgetLineDetailPageRoot")
        #if DEBUG
        .overlay(alignment: .topTrailing) {
            if PUL209VerifyState.pendingShowMenu {
                debugMenuOverlay
            }
        }
        #endif
    }

    @ViewBuilder
    private func transactionsList(line: BudgetLine, transactions: [Transaction]) -> some View {
        List {
            Section {
                heroSection(line: line, transactions: transactions)
                    .listRowCustomStyled(insets: EdgeInsets())
            }
            .listSectionSeparator(.hidden)

            if transactions.isEmpty {
                Section {
                    emptyStateView(for: line.kind)
                        .listRowCustomStyled(insets: EdgeInsets())
                }
                .listSectionSeparator(.hidden)
            } else {
                Section {
                    ForEach(transactions) { transaction in
                        transactionRow(for: transaction)
                    }
                } header: {
                    transactionsHeader(transactions: transactions)
                        .textCase(nil)
                }
            }
        }
        .listStyle(.plain)
        .listSectionSpacing(DesignTokens.Spacing.lg)
        .scrollContentBackground(.hidden)
    }

    private func transactionRow(for transaction: Transaction) -> some View {
        BudgetLineDetailTransactionRow(
            transaction: transaction,
            displayCurrency: userSettingsStore.currency,
            onTap: {
                router.push(.editTx(transactionId: transaction.id))
            }
        )
        .listRowBackground(Color.clear)
        .listRowSeparator(.visible)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            swipeActions(for: transaction)
        }
    }
}

// MARK: - Header Menu / Delete

private extension BudgetLineDetailPage {
    func headerMenu(for line: BudgetLine) -> some View {
        Menu {
            Button {
                onEditLine(line)
            } label: {
                Label("Modifier", systemImage: "pencil")
            }

            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                Label("Supprimer", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Plus d'options")
    }

    func deleteBudgetLine(_ line: BudgetLine) {
        // `softDeleteBudgetLine` removes the line from the data store
        // synchronously. Observation re-evaluates the body, the empty branch
        // fires `autoPopIfStillEmpty`, and the page pops.
        // We do NOT call `dismiss()` here — racing the auto-pop branch can
        // double-pop and accidentally pop the parent `BudgetDetailsView`.
        let ctx = ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.dispatch(.softDeleteBudgetLine(line, ctx)) }
    }
}

// MARK: - Transactions section

private extension BudgetLineDetailPage {
    func transactionsHeader(transactions: [Transaction]) -> some View {
        HStack {
            Text("Transactions")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(.primary)

            Spacer()

            Text(transactionCountLabel(count: transactions.count))
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)
        }
    }

    func transactionCountLabel(count: Int) -> String {
        switch count {
        case 0: "Aucune"
        case 1: "1 ce mois"
        default: "\(count) ce mois"
        }
    }

    func emptyStateView(for kind: TransactionKind) -> some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "tray")
                .font(PulpeTypography.amountHeroLight)
                .foregroundStyle(.quaternary)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text("Pas encore de transaction")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textSecondary)

                Text(emptyStateMessage(for: kind))
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.stepHeaderTop)
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    func emptyStateMessage(for kind: TransactionKind) -> String {
        switch kind {
        case .income: "Ajoute une transaction pour suivre tes revenus"
        case .saving: "Ajoute une transaction pour suivre ton épargne"
        case .expense: "Ajoute une transaction pour suivre tes dépenses"
        }
    }

    @ViewBuilder
    func swipeActions(for transaction: Transaction) -> some View {
        Button {
            let ctx = ToastContext(
                toastManager: appState.toastManager,
                presentationCurrency: userSettingsStore.currency
            )
            Task { await coordinator.dispatch(.softDeleteTransaction(transaction, ctx)) }
        } label: {
            Label("Supprimer", systemImage: "trash")
        }
        .tint(Color.destructivePrimary)

        Button {
            Task { await coordinator.dispatch(.toggleTransaction(transaction)) }
        } label: {
            Label(
                transaction.isChecked ? "Dépointer" : "Pointer",
                systemImage: transaction.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
            )
        }
        .tint(transaction.isChecked ? Color.financialOverBudget : .pulpePrimary)

        Button {
            router.push(.editTx(transactionId: transaction.id))
        } label: {
            Label("Modifier", systemImage: "pencil")
        }
        .tint(.editAction)
    }

    func addTransactionButton(line: BudgetLine) -> some View {
        Button {
            router.push(.addAllocatedTx(lineId: line.id))
        } label: {
            Label("Ajouter une transaction", systemImage: "plus")
        }
        .primaryButtonStyle()
    }
}
