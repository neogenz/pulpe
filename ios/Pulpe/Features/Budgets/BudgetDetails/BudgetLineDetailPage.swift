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
///   tap row     → present `BudgetDetailDestination.movement(transactionId:)`
///   tap "Ajouter" → present `BudgetDetailDestination.movement(lineId:)`
///
/// V2 `Enveloppe`: a light page, the line's figure in a white card, its movements in a
/// second card, and what can be done to the prévision in a last one.
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

    @State private var pendingDelete: BudgetLine?
    @State private var pendingPostpone: BudgetLine?

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
        @Bindable var syncStore = coordinator.syncStore

        return Group {
            if let line = budgetLine {
                pageContent(for: line, transactions: transactions)
            } else {
                // Line removed externally (delete commit, filter sync) →
                // auto-pop via shared helper after a grace period.
                AutoPopView { budgetLine == nil }
            }
        }
        .background { Color.appBackground.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(budgetLine?.name ?? "")
        // The page states the name in its own header.
        .toolbar(removing: .title)
        .alert(
            "Quelles prévisions supprimer ?",
            isPresented: $syncStore.showSavingsWithdrawalDeleteChoice,
            presenting: syncStore.budgetLineToDeleteWithdrawal
        ) { line in
            Button(savingsWithdrawalRepaymentDeleteLabel(for: line), role: .destructive) {
                dispatchDeleteSavingsWithdrawal(line, scope: .repayment)
            }
            Button(savingsWithdrawalPairDeleteLabel(for: line), role: .destructive) {
                dispatchDeleteSavingsWithdrawal(line, scope: .pair)
            }
            Button("Ne rien supprimer", role: .cancel) {
                coordinator.syncStore.resetSavingsWithdrawalDeleteChoice()
            }
        } message: { line in Text(savingsWithdrawalDeleteMessage(for: line)) }
    }

    private func pageContent(for line: BudgetLine, transactions: [Transaction]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                PageHeader(title: line.name, subtitle: headerSubtitle(for: line))
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.md)

                tagChips(for: line.tagIds)

                BudgetLineHeroCard(
                    line: line,
                    // Projector pre-computes consumption once per source change; zero for the
                    // rare frame that observes the line before it publishes.
                    consumption: projector.screenState.consumptionByLineId[line.id]
                        ?? BudgetFormulas.Consumption(allocated: 0, available: line.amount, percentage: 0),
                    currency: userSettingsStore.currency,
                    // ponytail: back to the month, where another prévision can be lowered;
                    // the Rattraper sheet (board 17) replaces this.
                    onCatchUp: { dismiss() }
                )
                .padding(.horizontal, DesignTokens.Spacing.lg)

                contextualLinks(for: line)

                movementsSection(line: line, transactions: transactions)
                    .padding(.top, DesignTokens.Spacing.xxl)

                forecastSection(line: line, hasMovements: !transactions.isEmpty)
                    .padding(.top, DesignTokens.Spacing.xxl)
            }
        }
        .pulpeRootBottomInset()
        .modifier(DeleteForecastConfirmation(
            line: $pendingDelete,
            dataStore: coordinator.dataStore,
            transactionsByLineId: projector.screenState.transactionsByLineId,
            currency: userSettingsStore.currency,
            onConfirm: deleteBudgetLine
        ))
        .modifier(PostponeConfirmation(
            line: $pendingPostpone,
            dataStore: coordinator.dataStore,
            currency: userSettingsStore.currency,
            onConfirm: postpone
        ))
        // This composite splits into several AX elements; bare, the identifier
        // stamps every one of them and clobbers the buttons' own.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("budgetLineDetailPageRoot")
    }

    /// « Dépense · chaque mois ».
    private func headerSubtitle(for line: BudgetLine) -> String {
        switch line.recurrence {
        case .fixed: AppLocale.string("\(line.kind.label) · chaque mois")
        case .oneOff: AppLocale.string("\(line.kind.label) · une fois")
        }
    }

    private func movementsSection(line: BudgetLine, transactions: [Transaction]) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(
                title: AppLocale.string("Mouvements"),
                link: (
                    label: AppLocale.string("Ajouter"),
                    action: { router.present(.movement(lineId: line.id, transactionId: nil)) }
                ),
                linkAccessibilityIdentifier: "budgetLineDetailPrimaryAction",
                linkSystemImage: "plus"
            )
            .padding(.horizontal, DesignTokens.Spacing.xs)

            MovementCard {
                if transactions.isEmpty {
                    emptyStateView(for: line.kind)
                } else {
                    ForEach(Array(transactions.enumerated()), id: \.element.id) { index, transaction in
                        if index > 0 {
                            Divider().overlay(Color.outlineVariant).padding(.leading, DesignTokens.ListRow.dividerInset)
                        }
                        movementRow(for: transaction)
                    }
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    /// « 3 nov. · pointé »: the date stands where the other lists name the prévision.
    private func movementRow(for transaction: Transaction) -> some View {
        MovementRow(
            transaction: transaction,
            lineName: Formatters.dayMonthLabel(for: transaction.transactionDate),
            currency: userSettingsStore.currency,
            isSyncing: coordinator.syncStore.isSyncing(txId: transaction.id),
            showsChevron: true,
            onToggle: { Task { await coordinator.dispatch(.toggleTransaction(transaction)) } },
            onOpen: { router.present(.movement(lineId: nil, transactionId: transaction.id)) }
        )
    }
}

// MARK: - Prévision actions

private extension BudgetLineDetailPage {
    /// What can be done to the prévision itself. Spreading and postponing only exist on a
    /// one-off line; a monthly one says so under the card rather than hiding them silently.
    func forecastSection(line: BudgetLine, hasMovements: Bool) -> some View {
        let isPostponeEligible = line.isPostponeEligible(hasAllocatedTransactions: hasMovements)
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Prévision"))
                .padding(.horizontal, DesignTokens.Spacing.xs)

            VStack(spacing: DesignTokens.Spacing.none) {
                actionRow(title: AppLocale.string("Modifier"), subtitle: AppLocale.string("Montant, nom, tags")) {
                    onEditLine(line)
                }
                if canSpread(line) {
                    FormRowDivider()
                    actionRow(title: AppLocale.string("Lisser sur plusieurs mois")) { presentSpread(for: line) }
                }
                if isPostponeEligible {
                    FormRowDivider()
                    postponeRow(line: line)
                }
                FormRowDivider()
                deleteRow(line: line)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()

            if line.recurrence == .fixed {
                Text("Lisser et reporter se font sur une prévision ponctuelle.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    func actionRow(title: String, subtitle: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            PulpeListRow(title: title, subtitle: subtitle) { EmptyView() }
        }
        .plainPressedButtonStyle()
    }

    /// Without next month's budget the row stays, greyed, and says what is missing (CA5).
    @ViewBuilder
    func postponeRow(line: BudgetLine) -> some View {
        let screenState = projector.screenState
        if screenState.canPostpone {
            let leaving = postponeSubtitle(screenState.hero.month, screenState.nextMonthLabel)
            actionRow(title: AppLocale.string("Reporter au mois suivant"), subtitle: leaving) { pendingPostpone = line }
                .accessibilityIdentifier("budgetLinePostponeRow")
        } else {
            let missing = screenState.nextMonthLabel.map { AppLocale.string("Crée d'abord le budget de \($0)") }
                ?? AppLocale.string("Crée d'abord le budget du mois suivant")
            PulpeListRow(title: AppLocale.string("Reporter au mois suivant"), subtitle: missing, showsChevron: false) {
                EmptyView()
            }
            .opacity(DesignTokens.Opacity.disabled)
            .accessibilityAddTraits(.isStaticText)
        }
    }

    /// « Elle quitte novembre pour décembre ».
    func postponeSubtitle(_ month: Int?, _ next: String?) -> String? {
        guard let month, let next else { return nil }
        return AppLocale.string("Elle quitte \(Formatters.monthNameInText(for: month)) pour \(next)")
    }

    func deleteRow(line: BudgetLine) -> some View {
        Button(role: .destructive) {
            // Linked line → explicit choice alert, not single-line delete (CA9).
            if line.savingsWithdrawalGroupId == nil {
                pendingDelete = line
            } else {
                deleteBudgetLine(line)
            }
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                Text("Supprimer la prévision")
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.destructivePrimary)
                Text("Ses mouvements deviennent des imprévus")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)
        }
        .plainPressedButtonStyle()
        .accessibilityIdentifier("budgetLineDetailDeleteRow")
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
    func postpone(_ line: BudgetLine) {
        let ctx = ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.postponeBudgetLine(line, context: ctx) }
    }
}
