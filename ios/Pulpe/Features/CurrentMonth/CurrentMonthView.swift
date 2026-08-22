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

    /// Same verdict the hero renders — `DriftCard`'s subtitle reads off this instead of
    /// re-deriving the planned/estimated subtraction on its own.
    private var overrunIsAbsorbed: Bool {
        HeroVerdictPresentation(
            plannedBalance: store.plannedRemaining,
            estimatedBalance: store.metrics.remaining
        ).absorbsEnvelopeOverrun
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
                CurrentMonthSkeletonView()
                    .transition(.opacity)
            case .failed:
                ErrorView(error: store.error ?? .networkError(URLError(.unknown))) {
                    await store.forceRefresh()
                }
                .transition(.opacity)
            case .empty:
                PulpeEmptyState(
                    systemImage: "calendar.badge.plus",
                    title: AppLocale.string("Pas encore de budget ce mois-ci"),
                    message: AppLocale.string("Crée-le pour voir ton tableau de bord"),
                    actionTitle: AppLocale.string("Créer un budget"),
                    isActionEnabled: canCreateBudget
                ) {
                    activeSheet = .createBudget
                }
                .transition(.opacity)
            case .loaded:
                dashboardContent
                    // The skeleton already holds every slot; the data arrives by coming into
                    // focus over it rather than popping in. Reduce Motion gets a plain fade.
                    .transition(loadedTransition)
            }
        }
        .background { Color.appBackground.ignoresSafeArea() }
        // The hero runs under the navigation bar: its title and avatar go to light ink
        // while the forest is painted, and back to the default on a flat canvas.
        .toolbarColorScheme(paintsHeroSurface ? .dark : nil, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
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
                        diameter: DesignTokens.IconSize.compact,
                        background: paintsHeroSurface ? .heroDisc : .surfaceContainerLowest,
                        foreground: paintsHeroSurface ? .heroInk : .textTertiary
                    )
                }
                .heroToolbarButtonStyle(paintsHeroSurface)
                .accessibilityLabel("Mon compte")
                .accessibilityIdentifier("homeAccountButton")
            }
            .heroToolbarGroup(paintsHeroSurface)
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
                appState.pushOnActiveStack(BudgetDestination.details(budgetId: budgetId))
            }
        }
        // Returning to the tab on top of a pushed page is a return to that page, not to the
        // accueil: refreshing here would fetch a month nobody is looking at, and the unwind
        // below would fetch it again a tap later.
        .onChange(of: appState.selectedTab) { oldTab, newTab in
            guard newTab == .currentMonth,
                  oldTab != .currentMonth,
                  appState.currentMonthPath.isEmpty else { return }
            refreshDetails()
        }
        // Coming back from the budget no longer crosses a tab boundary, so the tab change
        // above never fires for it: the accueil refreshes when its own stack unwinds.
        .onChange(of: appState.currentMonthPath.count) { oldCount, newCount in
            guard newCount == 0, oldCount > 0 else { return }
            refreshDetails()
        }
    }

    /// Re-reads the month after the user has been somewhere that can change it.
    private func refreshDetails() {
        store.invalidateCache()
        Task {
            await store.loadDetailsIfNeeded()
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                HomeHeroCard(
                    metrics: store.metrics,
                    fallbackPlannedBalance: store.plannedRemaining,
                    trajectory: store.balanceTrajectory,
                    monthName: currentMonthName,
                    uncheckedCount: store.uncheckedCount,
                    isSettling: store.isSettling,
                    onTapMetrics: { activeSheet = .realizedBalance },
                    onTapDetail: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 0)
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xxl)
                .heroZone(parallax: true)

                dashboardDetails
                    .padding(.top, DesignTokens.Spacing.xxl)
                    .padding(.bottom, DesignTokens.Spacing.lg)
                    .animation(DesignTokens.Animation.smoothEaseOut, value: conditionalBlocksState)
                    .contentZone()
            }
        }
        .refreshable {
            await store.forceRefresh()
        }
    }

    private var dashboardDetails: some View {
        // Wider than the gap inside a section: a section is now a heading on the page
        // plus a card, so the space between two of them has to beat the space between a
        // heading and the card it introduces, or the pairing reads the wrong way round.
        VStack(spacing: DesignTokens.Spacing.xxl) {
            if store.budget != nil {
                addOperationRow
            }
            // Opérations à pointer — only while something needs checking
            if !store.uncheckedItems.isEmpty {
                UncheckedOperationsCard(
                    items: store.uncheckedItems,
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
                                    AppLocale.string("\(item.name) pointé"),
                                    undo: { await undoToggle(item) },
                                    onFinishedWithoutUndo: {}
                                )
                                await maybePrimeReminders()
                            } else {
                                toastManager.show(
                                    AppLocale.string("\(item.name) n'a pas pu être pointé — réessaie"),
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
                DriftCard(
                    drifts: store.driftLines,
                    totalOver: store.driftTotal,
                    tagNamesById: tagStore.namesById,
                    overrunIsAbsorbed: overrunIsAbsorbed,
                    onCatchUp: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 2)
            } else if store.savingsSummary.isComplete {
                SavingsDoneCard(
                    amount: store.savingsSummary.totalRealized,
                    goalName: completedSavingsGoalName
                ) {
                    appState.pushOnActiveStack(SavingsGoalDestination.list)
                }
                .staggeredEntrance(isVisible: hasAppeared, index: 2)
            }

            // Activité — recent transactions with 7j/Mois window
            if !store.transactions.isEmpty {
                ActivityCard(
                    transactions: store.transactions,
                    tagNamesById: tagStore.namesById,
                    onViewAll: { navigateToBudget = true }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 3)
            }
        }
        // One content margin for the whole screen, aligned with the hero above, so the
        // section headings and the cards they introduce hang off a single vertical rail.
        .padding(.horizontal, DesignTokens.Spacing.xxl)
    }

    /// The one filled element in the content zone. Recording an operation is the act the
    /// whole app depends on, and dressed as a white card with a chevron it had the same
    /// weight as the records below it — and promised a list it doesn't open.
    private var addOperationRow: some View {
        Button { activeSheet = .addTransaction } label: {
            Label("Ajouter une opération", systemImage: "plus")
        }
        .primaryButtonStyle()
        .accessibilityLabel("Ajouter une opération")
        .accessibilityIdentifier("homeAddOperationButton")
    }
}

// MARK: - Retention hooks (post-onboarding handoff + notification priming)
//
// Kept in a same-file extension so the main `CurrentMonthView` body stays within its
// type-length budget while still reaching the view's `private` state (same-file
// access), rather than loosening encapsulation to move it to another file.
extension CurrentMonthView {
    /// Failed and empty keep a flat canvas; loaded and skeleton paint the forest through
    /// `heroZone()`, so the navigation bar ink follows the same switch.
    fileprivate var loadedTransition: AnyTransition {
        reduceMotion ? .opacity : AnyTransition(.blurReplace)
    }

    fileprivate var paintsHeroSurface: Bool {
        switch store.contentState {
        case .idle, .loading, .loaded: true
        case .failed, .empty: false
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
                AppLocale.string("\(item.name) n'a pas pu être annulé — réessaie depuis le budget"),
                type: .error
            )
        }
    }

    // MARK: - Copy Helpers

    private var currentMonthName: String {
        guard let budget = store.budget else { return "" }
        return Formatters.monthName(for: budget.month).lowercased()
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
