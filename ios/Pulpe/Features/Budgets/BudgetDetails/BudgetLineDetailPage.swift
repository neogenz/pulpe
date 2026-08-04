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
/// When the underlying line is removed (deleted or filtered out by sync), the
/// page auto-pops via `dismiss()` from the empty branch — no stale state.
struct BudgetLineDetailPage: View {
    let lineId: String
    let tagNamesById: [String: String]
    let onEditLine: (BudgetLine) -> Void
    @Environment(BudgetDetailsCoordinator.self) var coordinator
    @Environment(BudgetDetailsProjector.self) var projector
    @Environment(AppState.self) var appState
    @Environment(BudgetDetailsRouter.self) var router
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(SavingsGoalStore.self) var savingsGoalStore
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(\.dismiss) var dismiss

    @State private var showDeleteConfirmation = false
    @State private var pendingPostpone: PostponeTarget?

    // MARK: - Derived

    /// O(1) lookup from the projection's `lineById` index — symmetric with
    /// `transactionsByLineId` below. The view never reaches into
    /// `coordinator.dataStore` directly: every read flows through
    /// `BudgetDetailsScreenState`.
    private var budgetLine: BudgetLine? {
        projector.screenState.lineById[lineId]
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

            tagChips(for: line.tagIds)

            transactionsList(line: line, transactions: transactions)
        }
        .pulpeStickyBottomCTA(avoidsKeyboard: false) { addTransactionButton(line: line) }
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
        .postponeConfirmation(
            target: $pendingPostpone,
            nextMonthLabel: projector.screenState.nextMonthLabel
        ) { target in
            postpone(target)
        }
        .accessibilityIdentifier("budgetLineDetailPageRoot")
    }

    @ViewBuilder
    private func transactionsList(line: BudgetLine, transactions: [Transaction]) -> some View {
        List {
            Section {
                heroSection(line: line, transactions: transactions)
                    .listRowCustomStyled(insets: EdgeInsets())
            }
            .listSectionSeparator(.hidden)

            contextualLinksSection(for: line)

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
                    BudgetLineDetailTransactionsHeader(count: transactions.count)
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
            tagNames: TagChips.names(for: transaction.tagIds, namesById: tagNamesById),
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

            if canSpread(line) {
                Button {
                    presentSpread(for: line)
                } label: {
                    Label("Lisser sur plusieurs mois", systemImage: "calendar")
                }
            }

            PostponeMenuButton(
                isEligible: line.isPostponeEligible(
                    hasAllocatedTransactions: !transactions.isEmpty
                ),
                canPostpone: projector.screenState.canPostpone,
                nextMonthLabel: projector.screenState.nextMonthLabel,
                onPostpone: { pendingPostpone = .budgetLine(line) }
            )

            Button("Supprimer", systemImage: "trash", role: .destructive) {
                // Linked line → explicit choice alert, not single-line delete (CA9).
                if line.savingsWithdrawalGroupId == nil {
                    showDeleteConfirmation = true
                } else {
                    deleteBudgetLine(line)
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Plus d'options")
    }

    /// A prévision is spreadable only when it's a one-off expense/épargne that
    /// isn't already lissée, isn't a rollover, and isn't half of a withdrawal
    /// couple — spreading that deletes the source server-side and orphans it (CA9).
    func canSpread(_ line: BudgetLine) -> Bool {
        line.kind != .income
            && line.recurrence == .oneOff
            && line.spreadGroupId == nil
            && line.savingsWithdrawalGroupId == nil
            && !(line.isRollover ?? false)
    }

    func presentSpread(for line: BudgetLine) {
        guard let budget = coordinator.dataStore.budget else { return }
        router.present(.spreadExisting(SpreadExistingSource(
            id: line.id,
            sourceType: .budgetLine,
            kind: line.kind,
            name: line.name,
            total: line.amount,
            month: budget.month,
            year: budget.year
        )))
    }

    func deleteBudgetLine(_ line: BudgetLine) {
        // Soft-delete removes the line synchronously; the empty branch auto-pops.
        // No `dismiss()` — racing auto-pop can double-pop the parent. A linked
        // line is diverted by the coordinator to the choice alert (CA9).
        let ctx = ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.dispatch(.softDeleteBudgetLine(line, ctx)) }
    }

    // Optimistic remove → the page auto-pops once the line leaves the store; the
    // coordinator surfaces an error toast on failure (PUL-22).
    func postpone(_ target: PostponeTarget) {
        guard case .budgetLine(let line) = target else { return }
        let ctx = ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.postponeBudgetLine(line, context: ctx) }
    }
}

// MARK: - Transactions section

private extension BudgetLineDetailPage {
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
