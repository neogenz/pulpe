import SwiftUI
import TipKit
import WidgetKit

enum CurrentMonthSheet: Identifiable, Hashable {
    case calculation, createBudget, notificationPrime
    case addTransaction(FirstTransactionTracker.Source), feedback(promptNumber: Int)
    var id: Self { self }
}

struct CurrentMonthView: View {
    @Environment(AppState.self) var appState
    @Environment(CurrentMonthStore.self) var store
    @Environment(BudgetListStore.self) var budgetListStore
    // Internal, with `activeSheet` and `reminderPrefs`, for the reminders extension.
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(SavingsGoalStore.self) var savingsGoalStore
    @Environment(TagStore.self) var tagStore
    @Environment(ToastManager.self) var toastManager
    @State var activeSheet: CurrentMonthSheet?
    @Environment(UIPreferencesState.self) var uiPreferences
    @State var navigateToBudget = false
    @State var hasAppeared = false
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(\.horizontalSizeClass) var horizontalSizeClass
    @Environment(\.requestSavingsWithdrawal) var requestSavingsWithdrawal
    @Environment(\.requestEditMovement) var requestEditMovement
    /// How many movements and prévisions were left to point when a page was pushed over the
    /// accueil, so pointing there can still offer the reminders once the user comes back.
    @State private var uncheckedCountOnPush: Int?
    @State var pendingWithdrawal: SavingsWithdrawalRequest?

    /// The month a budget would be created for: the next one without a budget, else this one.
    private var noBudgetMonth: (month: Int, year: Int) {
        budgetListStore.nextAvailableMonth ?? {
            let now = Date()
            return (Calendar.current.component(.month, from: now), Calendar.current.component(.year, from: now))
        }()
    }

    private var referencedTagIds: Set<String> {
        Set(store.budgetLines.flatMap { $0.tagIds ?? [] } + store.transactions.flatMap { $0.tagIds ?? [] })
    }

    /// One-time post-onboarding handoff (teaches the pointer ritual + Lock Screen
    /// widget). Stateless UserDefaults wrapper — cheap to hold per render.
    private let postOnboardingFlags = PostOnboardingFlagsStore()

    /// Local reminder opt-in state. Stateless UserDefaults wrapper.
    let reminderPrefs = ReminderPreferences()

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
                HomeNoBudgetView(
                    month: noBudgetMonth.month,
                    year: noBudgetMonth.year,
                    isCreationAvailable: budgetListStore.nextAvailableMonth != nil,
                    onCreated: { budget in
                        budgetListStore.addBudget(budget)
                        store.invalidateCache()
                        Task { await store.loadDetailsIfNeeded() }
                    },
                    onPickOtherTemplate: { activeSheet = .createBudget }
                )
                .id("\(noBudgetMonth.year)-\(noBudgetMonth.month)")
                .transition(.opacity)
            case .loaded:
                Group {
                    if showsPanes { dashboardPanes } else { dashboardContent }
                }
                // The skeleton already holds every slot; the data arrives by coming into
                // focus over it rather than popping in. Reduce Motion gets a plain fade.
                .transition(loadedTransition)
            }
        }
        .background { Color.appBackground.ignoresSafeArea() }
        .trackScreen("Dashboard")
        .animation(DesignTokens.Animation.smoothEaseOut, value: animationPhase)
        // The month is the page's own large title; the bar keeps only its buttons, and the
        // title it would show stays for the « back » label of pushed pages.
        .navigationTitle(Tab.currentMonth.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    appState.currentMonthPath.append(CurrentMonthDestination.account)
                } label: {
                    ProfileAvatar(
                        firstName: appState.currentUser?.firstName,
                        email: appState.currentUser?.email,
                        avatarUrl: appState.currentUser?.avatarUrl,
                        diameter: DesignTokens.IconSize.compact,
                        background: .accentWash,
                        foreground: .accentInk
                    )
                }
                .accessibilityLabel("Mon compte")
                .accessibilityIdentifier("homeAccountButton")
            }
        }
        .sheet(item: $activeSheet, onDismiss: handOverPendingWithdrawal) { sheet in
            Group {
                switch sheet {
                case .calculation:
                    CalculationSheet()
                case .notificationPrime:
                    NotificationPrimeSheet {
                        Task { await enableReminders() }
                    }
                case .addTransaction(let source):
                    addTransactionSheet(source: source, store: store)
                case .feedback(let promptNumber):
                    AutomaticFeedbackSheet(promptNumber: promptNumber)
                case .createBudget:
                    if let nextMonth = budgetListStore.nextAvailableMonth {
                        CreateBudgetView(
                            month: nextMonth.month,
                            year: nextMonth.year,
                            existingPeriods: budgetListStore.existingPeriods
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
        .task {
            store.prepareForReload()
            // Ensure settings (payDay) are loaded before budget loading,
            // critical when user has PIN lock (settings aren't loaded at startup)
            await userSettingsStore.loadIfNeeded()
            store.setPayDay(userSettingsStore.payDayOfMonth)
            await store.loadDetailsIfNeeded()
            // Reveal with the details: waiting for the secondary loads below left the
            // loaded screen on stage with every block still at opacity 0 (bare forest
            // square under the bar, then a pop).
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(DesignTokens.Animation.smoothEaseOut) {
                    hasAppeared = true
                }
            }
            // After the reveal: the first-expense tip (PUL-306) can arrive a beat late
            await FirstTransactionTracker.shared.loadIfNeeded()
            // Sparse budget list feeds "retour au vert" (deficit hero) + create-budget gating
            await budgetListStore.loadIfNeeded()
            // Goal names for the "épargne versée" card — only when the month links to goals
            if store.budgetLines.contains(where: { $0.savingsGoalId != nil }) {
                await savingsGoalStore.loadIfNeeded()
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
            if oldCount == 0, newCount > 0 { uncheckedCountOnPush = store.uncheckedCount }
            guard newCount == 0, oldCount > 0 else { return }
            let pointedMeanwhile = uncheckedCountOnPush.map { store.uncheckedCount < $0 } ?? false
            uncheckedCountOnPush = nil
            refreshDetails()
            if pointedMeanwhile { Task { await maybePrimeReminders() } }
        }
        .automaticFeedbackPrompt(
            contentState: store.contentState,
            hasBlockingSheet: activeSheet != nil,
            isNavigating: navigateToBudget,
            isPostOnboardingHandoffPresented: isPostOnboardingHandoffPresented
        ) { promptNumber in
            activeSheet = .feedback(promptNumber: promptNumber)
        }
    }

    /// Re-reads the month after the user has been somewhere that can change it.
    private func refreshDetails() {
        store.invalidateCache()
        Task {
            await store.loadDetailsIfNeeded()
        }
    }

    /// Opens the operation's « Modifier » sheet, hosted by the tab with the budget's own stores,
    /// which open from the cache this store already primed.
    func editTransaction(_ transaction: Transaction) {
        guard let budgetId = store.budget?.id else { return }
        requestEditMovement?(budgetId, transaction.id)
    }
}

// MARK: - Retention hooks (post-onboarding handoff + notification priming)
// Kept in a same-file extension so the main view stays focused while these helpers
extension CurrentMonthView {
    fileprivate var animationPhase: Int {
        switch store.contentState {
        case .idle, .loading: 0
        case .failed: 1
        case .empty: 2
        case .loaded: 3
        }
    }

    var showsPanes: Bool { horizontalSizeClass == .regular }

    /// Crossfade only: `blurReplace` washed the page to a pale haze for a frame.
    fileprivate var loadedTransition: AnyTransition { .opacity }

    /// The cards that come and go, so the page animates their insertion and removal.
    var conditionalBlocksState: [Bool] {
        [store.uncheckedItems.isEmpty, store.driftLines.isEmpty, store.transactions.isEmpty]
    }

    // MARK: - Copy Helpers

    var currentMonthName: String {
        guard let budget = store.budget else { return "" }
        return Formatters.monthNameInText(for: budget.month)
    }

    /// The root shows the handoff over the tabs; no feedback prompt under it.
    private var isPostOnboardingHandoffPresented: Bool {
        appState.justCompletedOnboarding && !postOnboardingFlags.hasSeenPostOnboardingHandoff
    }
}
