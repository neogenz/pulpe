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

    @Environment(BudgetDetailsViewModel.self) private var viewModel
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.dismiss) private var dismiss

    @State private var showDeleteConfirmation = false

    // MARK: - Derived

    private var budgetLine: BudgetLine? {
        viewModel.budgetLines.first { $0.id == lineId }
    }

    private var transactions: [Transaction] {
        viewModel.transactions
            .filter { $0.budgetLineId == lineId }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let line = budgetLine {
                pageContent(for: line, transactions: transactions)
            } else {
                // Line removed externally (delete commit, filter sync) →
                // auto-pop after a short grace period. The grace gives the
                // first-frame reactivity window time to settle so a transient
                // empty state (rare) doesn't pop a freshly-pushed page.
                Color.clear.task { await autoPopIfStillEmpty() }
            }
        }
        .pulpeBackground()
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(budgetLine?.name ?? "")
    }

    private func autoPopIfStillEmpty() async {
        try? await Task.sleep(for: .milliseconds(150))
        guard !Task.isCancelled else { return }
        // Re-check via the computed property — Observation re-evaluates on
        // each access. If the model came back during the grace window, stay.
        if budgetLine == nil { dismiss() }
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
            Text("Tu peux toujours annuler depuis la notification.")
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
                    emptyStateView
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
                appState.budgetPath.append(
                    BudgetLinePushRoute.editTx(transactionId: transaction.id)
                )
            }
        )
        .listRowBackground(Color.clear)
        .listRowSeparator(.visible)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            swipeActions(for: transaction)
        }
    }
}

// MARK: - Hero / Title

private extension BudgetLineDetailPage {
    @ViewBuilder
    func heroSection(line: BudgetLine, transactions: [Transaction]) -> some View {
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        let remaining = line.amount - consumption.allocated
        let clampedProgress = CGFloat(min(max(consumption.percentage / 100, 0), 1))
        let stateColor = stateColor(for: consumption, kind: line.kind)
        let currency = userSettingsStore.currency
        // 2-decimal formatters everywhere on the budget detail page per
        // `feedback_two_decimals_ios_budget_detail` (2026-05-08): the page
        // renders ligne-level amounts, so `asCompactCurrency` is proscribed.
        let remainingLabel = amountsHidden ? "Montant masqué" : remaining.asCurrency(currency)
        let spentLabel = amountsHidden ? "Montant masqué" : consumption.allocated.asCurrency(currency)
        let plannedLabel = amountsHidden ? "Montant masqué" : line.amount.asCurrency(currency)

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Il reste")
                    .font(PulpeTypography.detailLabelBold)
                    .foregroundStyle(Color.textTertiary)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercase)

                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    Text(remaining.asAmount(for: currency))
                        .font(PulpeTypography.heroIcon)
                        .foregroundStyle(Color.textPrimary)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)

                    Text(currency.symbol)
                        .font(PulpeTypography.labelLargeBold)
                        .foregroundStyle(Color.textTertiary)
                }
                .sensitiveAmount()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Il reste \(remainingLabel)")
            }

            progressRow(progress: clampedProgress, percentage: consumption.percentage, color: stateColor)

            Text("\(spentLabel) dépensés sur \(plannedLabel) prévu")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    /// 3-state color matching DA §3.1 — comfortable / tight / deficit.
    func stateColor(for consumption: BudgetFormulas.Consumption, kind: TransactionKind) -> Color {
        if consumption.isOverBudget { return .financialOverBudget }
        if consumption.isNearLimit { return .warningPrimary }
        return Color.financialColor(for: kind)
    }

    func progressRow(progress: CGFloat, percentage: Double, color: Color) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.progressTrack)

                ProgressBarShape(progress: progress)
                    .fill(color)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)

            Text("\(Int(percentage.rounded()))%")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(Int(percentage.rounded()))% utilisé")
    }

    func titleWithKindDot(line: BudgetLine) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Circle()
                .fill(Color.financialColor(for: line.kind))
                .frame(width: DesignTokens.Spacing.sm, height: DesignTokens.Spacing.sm)

            Text(line.name)
                .font(PulpeTypography.title3)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)
                .truncationMode(.tail)

            Spacer(minLength: DesignTokens.Spacing.sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityLabel(line.name)
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
        // `softDeleteBudgetLine` removes the line from `viewModel.budgetLines`
        // synchronously. Observation re-evaluates the body, the empty branch
        // fires `autoPopIfStillEmpty`, and the page pops.
        // We do NOT call `dismiss()` here — racing the auto-pop branch can
        // double-pop and accidentally pop the parent `BudgetDetailsView`.
        viewModel.softDeleteBudgetLine(
            line,
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
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

    var emptyStateView: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "tray")
                .font(PulpeTypography.amountHeroLight)
                .foregroundStyle(.quaternary)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text("Pas encore de transaction")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textSecondary)

                Text("Ajoute une transaction pour suivre tes dépenses")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.stepHeaderTop)
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    @ViewBuilder
    func swipeActions(for transaction: Transaction) -> some View {
        Button {
            viewModel.softDeleteTransaction(
                transaction,
                toastManager: appState.toastManager,
                presentationCurrency: userSettingsStore.currency
            )
        } label: {
            Label("Supprimer", systemImage: "trash")
        }
        .tint(Color.destructivePrimary)

        Button {
            Task { await viewModel.toggleTransaction(transaction) }
        } label: {
            Label(
                transaction.isChecked ? "Dépointer" : "Pointer",
                systemImage: transaction.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
            )
        }
        .tint(transaction.isChecked ? Color.financialOverBudget : .pulpePrimary)

        Button {
            appState.budgetPath.append(
                BudgetLinePushRoute.editTx(transactionId: transaction.id)
            )
        } label: {
            Label("Modifier", systemImage: "pencil")
        }
        .tint(.editAction)
    }

    func addTransactionButton(line: BudgetLine) -> some View {
        Button {
            appState.budgetPath.append(
                BudgetLinePushRoute.addAllocatedTx(lineId: line.id)
            )
        } label: {
            Label("Ajouter une transaction", systemImage: "plus")
        }
        .primaryButtonStyle()
    }
}

#if DEBUG
private extension BudgetLineDetailPage {
    /// Visual-only stand-in for the toolbar `Menu`. SwiftUI's `Menu` cannot be
    /// opened programmatically, so the verification harness renders this static
    /// list with the same labels + ordering ("Modifier" / "Supprimer") as
    /// `headerMenu`. Pixel-accurate enough for the screenshot diff in PUL-209
    /// without forking the production view.
    @ViewBuilder
    var debugMenuOverlay: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Modifier")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.lg)
                Image(systemName: "pencil")
                    .foregroundStyle(Color.textPrimary)
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.sm)

            Divider()

            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Supprimer")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.destructivePrimary)
                Spacer(minLength: DesignTokens.Spacing.lg)
                Image(systemName: "trash")
                    .foregroundStyle(Color.destructivePrimary)
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .frame(width: 220)
        .pulpeCardBackground()
        .padding(.trailing, DesignTokens.Spacing.md)
        .padding(.top, DesignTokens.Spacing.xxxl)
        .accessibilityHidden(true)
    }
}
#endif
