import SwiftUI
import TipKit
import WidgetKit

private enum SheetDestination: Identifiable {
    case realizedBalance, account, createBudget, notificationPrime
    case addTransaction
    var id: Self { self }
}

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(TagStore.self) private var tagStore
    @Environment(ToastManager.self) private var toastManager
    @State private var activeSheet: SheetDestination?
    @State private var navigateToBudget = false
    @State private var hasAppeared = false
    /// Screen-space bottom edge of the hero block, published by whichever state is on screen.
    /// The mint stops here instead of at a fixed fraction of the screen height.
    @State private var heroSurfaceBottom: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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

    private var referencedTagIds: Set<String> {
        Set(store.budgetLines.flatMap { $0.tagIds ?? [] } + store.transactions.flatMap { $0.tagIds ?? [] })
    }

    /// One-time post-onboarding handoff (teaches the pointer ritual + Lock Screen
    /// widget). Stateless UserDefaults wrapper — cheap to hold per render.
    private let postOnboardingFlags = PostOnboardingFlagsStore()

    /// Local reminder opt-in state. Stateless UserDefaults wrapper.
    private let reminderPrefs = ReminderPreferences()

    var body: some View {
        ZStack {
            switch store.contentState {
            case .idle, .loading:
                CurrentMonthSkeletonView(onHeroSurfaceBottomChange: { heroSurfaceBottom = $0 })
                    .transition(.opacity)
            case .failed:
                ErrorView(error: store.error ?? .networkError(URLError(.unknown))) {
                    await store.forceRefresh()
                }
                .transition(.opacity)
            case .empty:
                PulpeEmptyState(
                    systemImage: "calendar.badge.plus",
                    title: "Pas encore de budget ce mois-ci",
                    message: "Crée-le pour voir ton tableau de bord",
                    actionTitle: "Créer un budget",
                    isActionEnabled: canCreateBudget
                ) {
                    activeSheet = .createBudget
                }
                .transition(.opacity)
            case .loaded:
                dashboardContent
                    .transition(.opacity)
            }
        }
        .background { dashboardBackground.ignoresSafeArea() }
        .trackScreen("Dashboard")
        .animation(DesignTokens.Animation.smoothEaseOut, value: animationPhase)
        .navigationTitle(currentMonthName.capitalized)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // One account affordance for every content state, in the bar that already
            // exists — the dashboard no longer rebuilds a header inside its own scroll.
            ToolbarItem(placement: .primaryAction) {
                Button {
                    activeSheet = .account
                } label: {
                    ProfileAvatar(
                        firstName: appState.currentUser?.firstName,
                        email: appState.currentUser?.email,
                        avatarUrl: appState.currentUser?.avatarUrl,
                        diameter: DesignTokens.IconSize.compact
                    )
                }
                .accessibilityLabel("Mon compte")
            }
        }
        .sheet(item: $activeSheet) { sheet in
            Group {
                switch sheet {
                case .realizedBalance:
                    RealizedBalanceSheet(
                        metrics: store.metrics,
                        realizedMetrics: store.realizedMetrics
                    )
                case .account:
                    AccountView()
                case .notificationPrime:
                    NotificationPrimeSheet {
                        Task { await enableReminders() }
                    }
                case .addTransaction:
                    if let budgetId = store.budget?.id {
                        AddTransactionSheet(budgetId: budgetId, onAdd: store.addTransaction)
                    }
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
            .suppressesTips()
        }
        .fullScreenCover(isPresented: showPostOnboardingHandoff) {
            PostOnboardingHandoffView {
                dismissPostOnboardingHandoff()
            }
            .suppressesTips()
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
        .task(id: referencedTagIds) {
            await tagStore.loadIfNeeded(for: referencedTagIds)
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
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                HomeHeroCard(
                    metrics: store.metrics,
                    plannedBalance: store.plannedRemaining,
                    trajectory: store.balanceTrajectory,
                    monthName: currentMonthName,
                    uncheckedCount: store.uncheckedCount,
                    onTapMetrics: { activeSheet = .realizedBalance },
                    onTapDetail: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 0)
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xxl)
                .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).maxY } action: {
                    heroSurfaceBottom = $0
                }

                dashboardDetails
                .frame(maxWidth: .infinity)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.lg)
                .animation(DesignTokens.Animation.smoothEaseOut, value: conditionalBlocksState)
            }
        }
        .refreshable {
            await store.forceRefresh()
        }
    }

    private var dashboardDetails: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            if store.budget != nil {
                Button("Ajouter une opération", systemImage: "plus") { activeSheet = .addTransaction }
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.pulpePrimary)
                    .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
                    .contentShape(Rectangle())
                    .plainPressedButtonStyle()
                    .accessibilityLabel("Ajouter une opération")
            }
            // Opérations à pointer — only while something needs checking
            if !store.uncheckedItems.isEmpty {
                Divider()

                UncheckedOperationsCard(
                    items: store.uncheckedItems,
                    totalCount: store.uncheckedCount,
                    tagNamesById: tagStore.namesById,
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
                                toastManager.showWithUndo(
                                    "\(item.name) pointé",
                                    undo: { await undoToggle(item) },
                                    onFinishedWithoutUndo: {}
                                )
                                await maybePrimeReminders()
                            } else {
                                toastManager.show(
                                    "\(item.name) n'a pas pu être pointé — réessaie",
                                    type: .error
                                )
                            }
                        }
                    },
                    onViewAll: { navigateToBudget = true }
                )
                .popoverTip(ProductTips.checking)
                .staggeredEntrance(isVisible: hasAppeared, index: 1)
            }

            // Ça dérive when the month drifts — else épargne versée when complete
            if !store.driftLines.isEmpty {
                Divider()

                DriftCard(
                    drifts: store.driftLines,
                    totalOver: store.driftTotal,
                    tagNamesById: tagStore.namesById,
                    adjustMonthName: nextMonthName,
                    onViewBudget: { navigateToBudget = true },
                    onCatchUp: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 2)
            } else if store.savingsSummary.isComplete {
                Divider()

                SavingsDoneCard(
                    amount: store.savingsSummary.totalRealized,
                    goalName: completedSavingsGoalName
                ) {
                    appState.savingsGoalsPath = NavigationPath()
                    appState.selectedTab = .savingsGoals
                }
                .staggeredEntrance(isVisible: hasAppeared, index: 2)
            }

            // Activité — recent transactions with 7j/Mois window
            if !store.transactions.isEmpty {
                Divider()

                ActivityCard(
                    transactions: store.transactions,
                    tagNamesById: tagStore.namesById,
                    onViewAll: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 3)
            }
        }
        // Flat ledger: one content margin for the whole screen, aligned with the hero above,
        // so every row hangs off a single vertical rail instead of each card's own inset.
        .padding(.horizontal, DesignTokens.Spacing.xxl)
    }
}

// MARK: - Retention hooks (post-onboarding handoff + notification priming)
//
// Kept in a same-file extension so the main `CurrentMonthView` body stays within its
// type-length budget while still reaching the view's `private` state (same-file
// access), rather than loosening encapsulation to move it to another file.
extension CurrentMonthView {
    /// The mint is a surface, not a wash: it runs full-bleed from the top of the screen down
    /// to the hero's own bottom edge, and stops there on a curve. A hard edge would read as
    /// banding at this contrast — the curve is what lets a pale tint hold a boundary.
    @ViewBuilder
    fileprivate var dashboardBackground: some View {
        switch store.contentState {
        case .idle, .loading, .loaded:
            ZStack(alignment: .top) {
                Color.homeBackground
                LinearGradient(
                    colors: [.homeHeroSurfaceTop, .homeHeroSurface],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: max(0, heroSurfaceBottom))
                .clipShape(
                    .rect(
                        bottomLeadingRadius: DesignTokens.CornerRadius.lg,
                        bottomTrailingRadius: DesignTokens.CornerRadius.lg
                    )
                )
            }
        case .failed, .empty:
            Color.homeBackground
        }
    }

    /// Drives insert/remove animations of the conditional blocks.
    private var conditionalBlocksState: [Bool] {
        [store.uncheckedItems.isEmpty, store.driftLines.isEmpty, store.savingsSummary.isComplete]
    }

    /// Reverse a successful check from the undo toast. The store toggles based on the
    /// passed value's state, so the undone item must be handed over as already-checked.
    private func undoToggle(_ item: CurrentMonthStore.CheckableItem) async {
        let didSucceed: Bool
        switch item {
        case .transaction(let transaction, _):
            didSucceed = await store.toggleTransaction(transaction.toggled())
        case .budgetLine(let line, _):
            didSucceed = await store.toggleBudgetLine(line.toggled())
        }
        if !didSucceed {
            toastManager.show(
                "\(item.name) n'a pas pu être annulé — réessaie depuis le budget",
                type: .error
            )
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

    /// Goal name shown on the savings card — only when every saving line maps to the same goal.
    private var completedSavingsGoalName: String? {
        let goalIds = Set(store.budgetLines.filter { $0.kind == .saving }.map(\.savingsGoalId))
        guard goalIds.count == 1, let goalId = goalIds.first ?? nil else { return nil }
        return savingsGoalStore.goals.first { $0.id == goalId }?.name
    }

    /// Presents the handoff exactly once, only for a user who JUST finished onboarding
    /// (`appState.justCompletedOnboarding`) and hasn't seen it before.
    private var showPostOnboardingHandoff: Binding<Bool> {
        Binding(
            get: {
                appState.justCompletedOnboarding
                    && !postOnboardingFlags.hasSeenPostOnboardingHandoff
            },
            set: { newValue in
                if !newValue { dismissPostOnboardingHandoff() }
            }
        )
    }

    private func dismissPostOnboardingHandoff() {
        postOnboardingFlags.setHasSeenPostOnboardingHandoff()
        appState.justCompletedOnboarding = false
    }

    /// After the user's first real "pointer", offer reminders exactly once — behind a
    /// value-framed sheet, and only while the OS prompt is still undecided so we never
    /// burn the one-shot iOS permission cold.
    private func maybePrimeReminders() async {
        guard !reminderPrefs.hasPrimedReminders else { return }
        guard await NotificationScheduler.shared.authorizationStatus() == .notDetermined,
              !reminderPrefs.hasPrimedReminders
        else { return }
        reminderPrefs.setHasPrimedReminders()
        AnalyticsService.shared.capture(.notificationPrimeShown)
        activeSheet = .notificationPrime
    }

    /// Fires the real OS prompt (from the "Activer" tap) and schedules the monthly
    /// reminder on grant. On denial we only record it — the toggle in Préférences
    /// stays the recovery path. Permission events gate on `promptShown` like
    /// `applyReminderPreference`: the sheet only appears on `.notDetermined`, but the
    /// status can settle from iOS Settings while it sits open, and a replayed verdict
    /// must not count as a fresh grant/denial.
    private func enableReminders() async {
        let promptShown = await NotificationScheduler.shared.authorizationStatus() == .notDetermined
        let granted = await NotificationScheduler.shared.requestAuthorization()
        guard granted else {
            if promptShown {
                AnalyticsService.shared.capture(.notificationPermissionDenied)
            }
            return
        }
        // Same event order as `applyReminderPreference` — permission verdict, then
        // toggle — so an ordered PostHog funnel captures both activation paths.
        if promptShown {
            AnalyticsService.shared.capture(.notificationPermissionGranted)
        }
        reminderPrefs.setRemindersEnabled(true)
        AnalyticsService.shared.capture(.reminderToggled, properties: ["enabled": true])
        // Settings not loaded yet → don't schedule for a made-up day 1; prefs are on,
        // so the next foreground reschedule heals with the real pay-day.
        guard let payDay = userSettingsStore.payDayOfMonth else { return }
        await NotificationScheduler.shared.scheduleMonthlyReminder(payDay: payDay)
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
    .environment(TagStore())
    .environment(ToastManager())
}
