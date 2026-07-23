import SwiftUI
import TipKit
import WidgetKit

private enum SheetDestination: Identifiable {
    case realizedBalance
    case account
    case createBudget

    var id: Self { self }
}

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(ToastManager.self) private var toastManager
    @State private var activeSheet: SheetDestination?
    @State private var navigateToBudget = false
    @State private var hasAppeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.tabBarClearance) private var tabBarClearance

    private var animationPhase: Int {
        switch store.contentState {
        case .idle, .loading: 0
        case .failed: 1
        case .empty: 2
        case .loaded: 3
        }
    }

    private var canCreateBudget: Bool {
        budgetListStore.nextAvailableMonth != nil
    }

    var body: some View {
        ZStack {
            switch store.contentState {
            case .idle, .loading:
                CurrentMonthSkeletonView()
                    .transition(.opacity)
            case .failed:
                ErrorView(error: store.error ?? .networkError(URLError(.unknown))) {
                    await store.forceRefresh()
                }
                .transition(.opacity)
            case .empty:
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Image(systemName: "calendar.badge.plus")
                        .font(PulpeTypography.emojiDisplay)
                        .foregroundStyle(Color.textTertiary)
                        .symbolEffect(.pulse, options: .nonRepeating)
                        .accessibilityHidden(true)
                    Text("Pas encore de budget ce mois-ci")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Crée-le pour voir ton tableau de bord")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textTertiary)
                        .multilineTextAlignment(.center)
                    Button("Créer un budget") {
                        activeSheet = .createBudget
                    }
                    .disabled(!canCreateBudget)
                    .primaryButtonStyle(isEnabled: canCreateBudget)
                }
                .padding(DesignTokens.Spacing.xxxl)
                .transition(.opacity)
            case .loaded:
                dashboardContent
                    .transition(.opacity)
            }
        }
        .background { Color.homeBackground.ignoresSafeArea() }
        .trackScreen("Dashboard")
        .animation(DesignTokens.Animation.smoothEaseOut, value: animationPhase)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // Loaded state exposes Account via the greeting avatar; keep a
            // toolbar entry for the other states so Account is always reachable.
            if store.contentState != .loaded {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        activeSheet = .account
                    } label: {
                        Image(systemName: "person.circle")
                    }
                    .accessibilityLabel("Mon compte")
                }
            }
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .realizedBalance:
                RealizedBalanceSheet(
                    metrics: store.metrics,
                    realizedMetrics: store.realizedMetrics
                )
            case .account:
                AccountView()
            case .createBudget:
                if let nextMonth = budgetListStore.nextAvailableMonth {
                    CreateBudgetView(
                        month: nextMonth.month,
                        year: nextMonth.year
                    ) { budget in
                        budgetListStore.addBudget(budget)
                        store.invalidateCache()
                        Task {
                            await store.loadDetailsIfNeeded()
                        }
                    }
                }
            }
        }
        .task {
            store.prepareForReload()
            // Ensure settings (payDay) are loaded before budget loading,
            // critical when user has PIN lock (settings aren't loaded at startup)
            await userSettingsStore.loadIfNeeded()
            store.setPayDay(userSettingsStore.payDayOfMonth)
            await store.loadDetailsIfNeeded()
            // Sparse budget list feeds "retour au vert" (deficit hero) + create-budget gating
            await budgetListStore.loadIfNeeded()
            // Goal names for the "épargne versée" card — only when the month links to goals
            if store.budgetLines.contains(where: { $0.savingsGoalId != nil }) {
                await savingsGoalStore.loadIfNeeded()
            }
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(DesignTokens.Animation.smoothEaseOut) {
                    hasAppeared = true
                }
            }
        }
        .onChange(of: navigateToBudget) { _, shouldNavigate in
            if shouldNavigate, let budgetId = store.budget?.id {
                navigateToBudget = false
                // Clear path without animation while Budgets tab is offscreen
                var transaction = SwiftUI.Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    appState.budgetPath = NavigationPath()
                }
                // Next run loop: old view is destroyed, push fresh + switch tab
                Task { @MainActor in
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                    appState.selectedTab = .budgets
                }
            }
        }
        .onChange(of: appState.selectedTab) { oldTab, newTab in
            guard newTab == .currentMonth, oldTab != .currentMonth else { return }
            store.invalidateCache()
            Task {
                await store.loadDetailsIfNeeded()
            }
        }
        .onChange(of: activeSheet) { _, sheet in
            ProductTips.isSheetPresented = sheet != nil
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.lg) {
                // 1. Greeting + account avatar
                DashboardGreeting(
                    firstName: appState.currentUser?.firstName,
                    email: appState.currentUser?.email,
                    avatarUrl: appState.currentUser?.avatarUrl
                ) {
                    activeSheet = .account
                }
                .staggeredEntrance(isVisible: hasAppeared, index: 0)

                // 2. Mint hero — remaining, state chip, progress, budget detail entry
                HomeHeroCard(
                    metrics: store.metrics,
                    monthName: currentMonthName,
                    realizedOutflows: store.realizedMetrics.realizedExpenses,
                    dayProgress: store.periodDayProgress(),
                    dailyMargin: store.dailyBudget(),
                    deficitContext: deficitContext,
                    onTapMetrics: { activeSheet = .realizedBalance },
                    onTapDetail: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 1)

                // 3. Opérations à pointer — only while something needs checking
                if !store.uncheckedItems.isEmpty {
                    UncheckedOperationsCard(
                        items: store.uncheckedItems,
                        totalCount: store.uncheckedCount,
                        syncingBudgetLineIds: store.syncingBudgetLineIds,
                        syncingTransactionIds: store.syncingTransactionIds,
                        onToggle: { item in
                            ProductTips.checking.invalidate(reason: .actionPerformed)
                            Task {
                                let didSucceed: Bool
                                switch item {
                                case .transaction(let transaction, _):
                                    didSucceed = await store.toggleTransaction(transaction)
                                case .budgetLine(let line, _):
                                    didSucceed = await store.toggleBudgetLine(line)
                                }
                                if didSucceed {
                                    // The item leaves the screen on success — without an exit
                                    // ramp, recovering from an accidental check means hunting
                                    // it down in the budget detail.
                                    toastManager.showWithUndo(
                                        "\(item.name) pointé",
                                        undo: { await undoToggle(item) },
                                        onFinishedWithoutUndo: {}
                                    )
                                } else {
                                    // The optimistic row silently reverts otherwise, right
                                    // after the success haptic already told the user it worked.
                                    toastManager.show(
                                        "\(item.name) n'a pas pu être pointé",
                                        type: .error
                                    )
                                }
                            }
                        },
                        onViewAll: { navigateToBudget = true }
                    )
                    .popoverTip(ProductTips.checking)
                    .staggeredEntrance(isVisible: hasAppeared, index: 2)
                }

                // 4. Ça dérive when the month drifts — else épargne versée when complete
                if !store.driftLines.isEmpty {
                    DriftCard(
                        drifts: store.driftLines,
                        totalOver: store.driftTotal,
                        adjustMonthName: nextMonthName,
                        onViewBudget: { navigateToBudget = true },
                        onCatchUp: { navigateToBudget = true }
                    )
                    .staggeredEntrance(isVisible: hasAppeared, index: 3)
                } else if store.savingsSummary.isComplete {
                    SavingsDoneCard(
                        amount: store.savingsSummary.totalRealized,
                        goalName: completedSavingsGoalName
                    ) {
                        appState.savingsGoalsPath = NavigationPath()
                        appState.selectedTab = .savingsGoals
                    }
                    .staggeredEntrance(isVisible: hasAppeared, index: 3)
                }

                // 5. Activité — recent transactions with 7j/Mois window
                if !store.transactions.isEmpty {
                    ActivityCard(
                        transactions: store.transactions,
                        onViewAll: { navigateToBudget = true }
                    )
                    .staggeredEntrance(isVisible: hasAppeared, index: 4)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, tabBarClearance + DesignTokens.Spacing.lg)
            .animation(DesignTokens.Animation.smoothEaseOut, value: conditionalBlocksState)
        }
        .refreshable {
            await store.forceRefresh()
        }
    }

    /// Drives insert/remove animations of the conditional blocks.
    private var conditionalBlocksState: [Bool] {
        [store.uncheckedItems.isEmpty, store.driftLines.isEmpty, store.savingsSummary.isComplete]
    }

    /// Reverse a successful check from the undo toast. The store toggles based on the
    /// passed value's state, so the undone item must be handed over as already-checked.
    private func undoToggle(_ item: CurrentMonthStore.CheckableItem) async {
        switch item {
        case .transaction(let transaction, _):
            await store.toggleTransaction(transaction.toggled())
        case .budgetLine(let line, _):
            await store.toggleBudgetLine(line.toggled())
        }
    }

    // MARK: - Copy Helpers

    private var currentMonthName: String {
        guard let budget = store.budget else { return "" }
        return Formatters.monthName(for: budget.month).lowercased()
    }

    private var nextMonthName: String {
        guard let budget = store.budget else { return "le mois prochain" }
        let next = budget.month == 12 ? 1 : budget.month + 1
        return Formatters.monthName(for: next).lowercased()
    }

    /// Deficit hero line: "Report auto en août · retour au vert en septembre".
    /// The second part appears only when a future budget already balances out.
    private var deficitContext: String {
        var line = "Report auto en \(nextMonthName)"
        if let month = firstBackInGreenMonth {
            line += " · retour au vert en \(month)"
        }
        return line
    }

    private var firstBackInGreenMonth: String? {
        guard let budget = store.budget else { return nil }
        return budgetListStore.budgets
            .filter { sparse in
                guard let month = sparse.month, let year = sparse.year,
                      sparse.remaining != nil else { return false }
                return year > budget.year || (year == budget.year && month > budget.month)
            }
            .sorted { (($0.year ?? 0), ($0.month ?? 0)) < (($1.year ?? 0), ($1.month ?? 0)) }
            .first { ($0.remaining ?? -1) >= 0 }
            .flatMap(\.month)
            .map { Formatters.monthName(for: $0).lowercased() }
    }

    /// Goal name shown on the savings card — only when the month's savings
    /// all map to a single goal.
    private var completedSavingsGoalName: String? {
        let goalIds = Set(store.budgetLines.filter { $0.kind == .saving }.compactMap(\.savingsGoalId))
        guard goalIds.count == 1, let goalId = goalIds.first else { return nil }
        return savingsGoalStore.goals.first { $0.id == goalId }?.name
    }
}

// MARK: - Skeleton

private struct CurrentMonthSkeletonView: View {
    @Environment(\.tabBarClearance) private var tabBarClearance

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.lg) {
                // Greeting placeholder
                HStack {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    Spacer()
                    SkeletonCircle(size: DesignTokens.IconSize.listRow)
                }

                // Hero card placeholder
                SkeletonShape(
                    height: DesignTokens.Skeleton.heroHeight,
                    cornerRadius: DesignTokens.CornerRadius.lg
                )

                // Cards placeholders
                ForEach(0..<2, id: \.self) { _ in
                    VStack(spacing: DesignTokens.Spacing.sm) {
                        ForEach(0..<2, id: \.self) { _ in
                            SkeletonRow()
                        }
                    }
                    .padding(DesignTokens.Spacing.lg)
                    .pulpeCardBackground()
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, tabBarClearance + DesignTokens.Spacing.lg)
        }
        .shimmering()
        .accessibilityLabel("Préparation de ton tableau de bord")
    }
}

#Preview {
    NavigationStack {
        CurrentMonthView()
    }
    .environment(AppState())
    .environment(CurrentMonthStore())
    .environment(BudgetListStore())
    .environment(UserSettingsStore())
    .environment(SavingsGoalStore())
}
