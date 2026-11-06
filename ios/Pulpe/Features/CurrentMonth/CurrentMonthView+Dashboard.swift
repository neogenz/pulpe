import SwiftUI

// MARK: - Dashboard

extension CurrentMonthView {
    /// The first month of an account that has not recorded anything: the hero drops its plot
    /// and « À faire » gives way to « Pour bien démarrer ».
    var isFirstMonthStart: Bool {
        FirstTransactionTracker.shared.isAwaitingFirstTransaction && store.transactions.isEmpty
    }

    var dashboardContent: some View {
        // Pinned to the width offered, read before anything inside is laid out: nothing can
        // widen the page and let it pan sideways (#704). Neither `containerRelativeFrame` nor
        // a width kept in state: both held the open iPhone Duo's width once it closed.
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    homeHeader
                    heroCard
                    dashboardDetails
                }
                .padding(.top, DesignTokens.Spacing.sm)
                .animation(DesignTokens.Animation.smoothEaseOut, value: conditionalBlocksState)
                .frame(width: geometry.size.width)
            }
            .refreshable { await store.forceRefresh() }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    /// The open iPhone Duo: the hero holds still on the left while the lists are worked
    /// through on the right, so where the month ends stays in view and moves with each pointing.
    var dashboardPanes: some View {
        // Shares of the space offered, read before anything inside is laid out: a chart or a
        // card asking for more room can never widen a pane (#704), and they follow a resize.
        GeometryReader { geometry in
            let heroWidth = max(
                geometry.size.width * DesignTokens.Layout.heroPaneWidthRatio,
                DesignTokens.Layout.heroPaneMinWidth
            )
            HStack(alignment: .top, spacing: DesignTokens.Spacing.none) {
                ScrollView {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                        homeHeader
                        heroCard
                    }
                    .frame(width: heroWidth)
                }
                .frame(width: heroWidth)

                ScrollView {
                    dashboardDetails
                        .padding(.top, DesignTokens.Spacing.xxl)
                        .animation(DesignTokens.Animation.smoothEaseOut, value: conditionalBlocksState)
                        .frame(width: geometry.size.width - heroWidth)
                }
                .frame(width: geometry.size.width - heroWidth)
                .refreshable { await store.forceRefresh() }
            }
        }
    }

    /// The month as a large title, with where the period stands under it.
    private var homeHeader: some View {
        PageHeader(
            title: currentMonthName.capitalized,
            subtitle: HomePresentation.periodCaption(
                progress: store.periodDayProgress(),
                periodEnd: store.balanceTrajectory?.periodEnd
            )
        )
        .staggeredEntrance(isVisible: hasAppeared, index: 0)
    }

    private var heroCard: some View {
        HomeHeroCard(
            metrics: store.metrics,
            fallbackPlannedBalance: store.plannedRemaining,
            trajectory: isFirstMonthStart ? nil : store.balanceTrajectory,
            monthName: currentMonthName,
            isSettling: store.isSettling,
            startsFresh: isFirstMonthStart,
            onToggleAmounts: uiPreferences.toggleAmountsVisibility,
            onTapCalculation: { activeSheet = .calculation }
        )
        .staggeredEntrance(isVisible: hasAppeared, index: 1)
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    private var dashboardDetails: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
            if isFirstMonthStart {
                HomeStartCard(
                    uncheckedNames: store.allUncheckedItems.map(\.name),
                    onAddFirstExpense: { activeSheet = .addTransaction(.activationPrompt) },
                    onPoint: { appState.pushOnActiveStack(CurrentMonthDestination.toPoint) }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 2)
            } else {
                HomeTodoCard(
                    onPoint: { appState.pushOnActiveStack(CurrentMonthDestination.toPoint) },
                    onPointItem: pointItem,
                    onOpenItem: openItem,
                    onCatchUp: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 2)
            }

            RecentMovementsSection(
                transactions: store.transactions,
                budgetLines: store.budgetLines,
                syncingTransactionIds: store.syncingTransactionIds,
                onToggle: pointTransaction,
                onEdit: editTransaction,
                onViewAll: { appState.pushOnActiveStack(CurrentMonthDestination.movements) }
            )
            .staggeredEntrance(isVisible: hasAppeared, index: 3)
        }
        // One content margin for the whole screen, on the rail the hero card hangs off.
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.lg)
    }

    private func pointItem(_ item: CurrentMonthStore.CheckableItem) {
        Task {
            ProductTips.checking.invalidate(reason: .actionPerformed)
            if await store.point(item, toasts: toastManager) { await maybePrimeReminders() }
        }
    }

    private func openItem(_ item: CurrentMonthStore.CheckableItem) {
        switch item {
        case .transaction(let transaction, _): editTransaction(transaction)
        case .budgetLine(let line, _): appState.pushOnActiveStack(BudgetDestination.details(budgetId: line.budgetId))
        }
    }

    private func pointTransaction(_ transaction: Transaction) {
        Task {
            ProductTips.checking.invalidate(reason: .actionPerformed)
            let wasUnpointed = !transaction.isChecked
            let didSucceed = await store.togglePointing(of: transaction, toasts: toastManager)
            if didSucceed, wasUnpointed { await maybePrimeReminders() }
        }
    }
}
