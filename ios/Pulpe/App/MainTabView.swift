import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        TabView(selection: $state.selectedTab) {
            SwiftUI.Tab(
                Tab.currentMonth.title,
                systemImage: Tab.currentMonth.icon,
                value: Tab.currentMonth
            ) {
                CurrentMonthTab()
            }

            SwiftUI.Tab(
                Tab.budgets.title,
                systemImage: Tab.budgets.icon,
                value: Tab.budgets
            ) {
                BudgetsTab()
            }

            SwiftUI.Tab(
                Tab.savingsGoals.title,
                systemImage: Tab.savingsGoals.icon,
                value: Tab.savingsGoals
            ) {
                SavingsGoalsTab()
            }

            SwiftUI.Tab(
                Tab.templates.title,
                systemImage: Tab.templates.icon,
                value: Tab.templates
            ) {
                TemplatesTab()
            }
        }
        .tint(Color.pulpePrimary)
        .pulpeBackground()
        .onChange(of: appState.selectedTab) { _, newTab in
            #if DEBUG
            guard ProcessInfo.processInfo.environment["UITEST_CAPTURE_TAB"] == nil else { return }
            #endif
            AnalyticsService.shared.capture(.tabSwitched, properties: ["tab": newTab.rawValue])
        }
        .onChange(of: PendingReminderTap.shared.opensCurrentMonth, initial: true) { _, opens in
            guard opens else { return }
            PendingReminderTap.shared.opensCurrentMonth = false
            appState.currentMonthPath = NavigationPath()
            appState.selectedTab = .currentMonth
        }
        .task {
            #if DEBUG
            guard let rawValue = ProcessInfo.processInfo.environment["UITEST_CAPTURE_TAB"],
                  let tab = Tab(rawValue: rawValue) else { return }
            appState.selectedTab = tab
            #endif
        }
    }
}

// MARK: - Budget destinations

/// Resolves a budget destination for every stack. Only `BudgetsTab` passes
/// services: it is the one entry point that injects test doubles.
@MainActor @ViewBuilder
private func budgetDestination(
    _ destination: BudgetDestination,
    budgetService: any BudgetServicing = BudgetService.shared,
    budgetLineService: any BudgetLineServicing = BudgetLineService.shared
) -> some View {
    switch destination {
    case .details(let budgetId):
        BudgetDetailsView(
            budgetId: budgetId,
            budgetService: budgetService,
            budgetLineService: budgetLineService
        )
        .ignoresForeignKeyboardInset()
    case .editTransaction(let budgetId, let transactionId):
        // Bare: this one owns the field that raises the keyboard.
        EditTransactionHost(
            budgetId: budgetId,
            transactionId: transactionId,
            budgetService: budgetService,
            budgetLineService: budgetLineService
        )
    }
}

// MARK: - Savings goal destinations

/// Resolves a savings-goal destination for every stack. Only `BudgetsTab` passes a
/// service: it is the one entry point that injects test doubles.
@MainActor @ViewBuilder
private func savingsGoalDestination(
    _ destination: SavingsGoalDestination,
    service: any SavingsGoalServicing = SavingsGoalService.shared
) -> some View {
    switch destination {
    case .list:
        SavingsGoalsListView()
            .ignoresForeignKeyboardInset()
    case .detail(let goal):
        SavingsGoalDetailView(goal: goal, service: service)
            .ignoresForeignKeyboardInset()
    }
}

// MARK: - Current Month Tab

struct CurrentMonthTab: View {
    @Environment(AppState.self) private var appState
    @State private var router = BudgetDetailsRouter()

    var body: some View {
        @Bindable var state = appState

        // The accueil is a set of shortcuts into budgets and objectifs, so it registers
        // their destinations too: a shortcut that switched tabs instead of pushing left
        // the back button pointing at the other section's root.
        NavigationStack(path: $state.currentMonthPath) {
            CurrentMonthView()
                .environment(\.requestSavingsWithdrawal, openSavingsWithdrawal)
                .ignoresForeignKeyboardInset()
                .navigationDestination(for: BudgetDestination.self) { destination in
                    budgetDestination(destination)
                }
                .navigationDestination(for: SavingsGoalDestination.self) { destination in
                    savingsGoalDestination(destination)
                }
        }
        .environment(router)
        .task { router.bind(to: appState) }
    }

    /// « À remettre » from the accueil (PUL-292): the month's budget page, where the
    /// new Revenu lands, with the existing withdrawal preview on top. The preview
    /// is presented by that page's own `.sheet(item: $router.sheet)` once it is on screen.
    private func openSavingsWithdrawal(_ request: SavingsWithdrawalRequest) {
        appState.pushOnActiveStack(BudgetDestination.details(budgetId: request.budgetId))
        router.present(.savingsWithdrawal(SavingsWithdrawalPrefill(
            budgetId: request.budgetId,
            anchorMonth: request.month,
            anchorYear: request.year,
            amount: request.amount,
            inputCurrency: request.inputCurrency,
            source: request.source,
            startsAtPreview: true
        )))
    }
}

// MARK: - Savings Goals Tab

struct SavingsGoalsTab: View {
    @Environment(AppState.self) private var appState
    /// A goal's withdrawal history leads into the budgets it funded (PUL-329), so
    /// this stack hosts budget screens too — and they need the same router the
    /// other two tabs provide.
    @State private var router = BudgetDetailsRouter()

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.savingsGoalsPath) {
            SavingsGoalsListView()
                .ignoresForeignKeyboardInset()
                .navigationDestination(for: SavingsGoalDestination.self) { destination in
                    savingsGoalDestination(destination)
                }
                .navigationDestination(for: BudgetDestination.self) { destination in
                    budgetDestination(destination)
                }
        }
        .environment(router)
        .task { router.bind(to: appState) }
    }
}

// MARK: - Budgets Tab

struct BudgetsTab: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private let budgetService: any BudgetServicing
    private let budgetLineService: any BudgetLineServicing
    private let savingsGoalService: any SavingsGoalServicing
    /// Tab-scoped router instance. Owns sheet state and provides the typed
    /// push API used inside the BudgetDetails feature; `appState.budgetPath`
    /// remains the underlying NavigationPath surface for cross-feature
    /// entries (deep link, BudgetList CTA, CurrentMonth CTA).
    @State private var router = BudgetDetailsRouter()

    init(
        budgetService: any BudgetServicing = BudgetService.shared,
        budgetLineService: any BudgetLineServicing = BudgetLineService.shared,
        savingsGoalService: any SavingsGoalServicing = SavingsGoalService.shared
    ) {
        self.budgetService = budgetService
        self.budgetLineService = budgetLineService
        self.savingsGoalService = savingsGoalService
    }

    var body: some View {
        Group {
            // The open iPhone Duo plans the year: its months stay beside the month being
            // edited, so a change in July shows on August's balance without going back.
            if horizontalSizeClass == .regular {
                monthsBesideMonth
            } else {
                monthsThenMonth
            }
        }
        .environment(router)
        .task { router.bind(to: appState) }
        .onChange(of: horizontalSizeClass) { appState.resetBudgetStack() }
    }

    private var monthsThenMonth: some View {
        @Bindable var state = appState

        return NavigationStack(path: $state.budgetPath) {
            BudgetListView()
                .ignoresForeignKeyboardInset()
                .modifier(budgetStackDestinations)
        }
    }

    private var monthsBesideMonth: some View {
        @Bindable var state = appState

        // Two stacks rather than a NavigationSplitView: on the Duo the split view keeps its
        // own 320pt sidebar and, in portrait, slides it over the month instead of beside it.
        return HStack(spacing: 0) {
            NavigationStack {
                BudgetListView(selectsInPlace: true, selectedBudgetId: shownBudgetId)
                    .ignoresForeignKeyboardInset()
                    // The list never reaches the window's trailing edge, yet its stack inherits
                    // the landscape tab bar's inset there and squeezed every row by that much.
                    .ignoresSafeArea(.container, edges: .trailing)
            }
            .environment(\.contentZoneSquareCorners, [.leading, .trailing])
            .containerRelativeFrame(.horizontal) { width, _ in
                min(
                    max(width * DesignTokens.Layout.budgetSidebarWidthRatio, DesignTokens.Layout.budgetSidebarMinWidth),
                    DesignTokens.Layout.budgetSidebarMaxWidth
                )
            }

            Divider()
                .ignoresSafeArea()

            NavigationStack(path: $state.budgetPath) {
                Group {
                    if let shownBudgetId {
                        budgetDestination(
                            .details(budgetId: shownBudgetId),
                            budgetService: budgetService,
                            budgetLineService: budgetLineService
                        )
                    } else {
                        ContentUnavailableView("Choisis un mois", systemImage: "calendar")
                            .pulpeBackground()
                    }
                }
                .modifier(budgetStackDestinations)
            }
            .environment(\.contentZoneSquareCorners, .leading)
        }
        .environment(\.budgetMonthsInSidebar, true)
    }

    /// The month picked in the list, else the one in progress: the open Duo never shows
    /// an empty page beside a list that has months. A month deleted from the page falls
    /// back the same way once the list reloads.
    private var shownBudgetId: String? {
        Self.shownBudgetId(
            selection: appState.budgetSelection,
            budgets: budgetListStore.budgets,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    nonisolated static func shownBudgetId(selection: String?, budgets: [BudgetSparse], payDayOfMonth: Int?) -> String? {
        if let selection, budgets.contains(where: { $0.id == selection }) {
            return selection
        }
        return budgets.first { $0.isCurrentPeriod(payDayOfMonth: payDayOfMonth) }?.id ?? budgets.last?.id
    }

    private var budgetStackDestinations: BudgetStackDestinations {
        BudgetStackDestinations(
            budgetService: budgetService,
            budgetLineService: budgetLineService,
            savingsGoalService: savingsGoalService
        )
    }
}

/// Destinations every budgets stack resolves, whichever layout hosts it.
private struct BudgetStackDestinations: ViewModifier {
    let budgetService: any BudgetServicing
    let budgetLineService: any BudgetLineServicing
    let savingsGoalService: any SavingsGoalServicing

    func body(content: Content) -> some View {
        content
            .navigationDestination(for: BudgetDestination.self) { destination in
                budgetDestination(
                    destination,
                    budgetService: budgetService,
                    budgetLineService: budgetLineService
                )
            }
            // A saving prévision's detail can push its linked goal's
            // progression (PUL-12) — same destination as the CurrentMonth
            // stack, registered here for the budget branch.
            .navigationDestination(for: SavingsGoalDestination.self) { destination in
                savingsGoalDestination(destination, service: savingsGoalService)
            }
    }
}

// MARK: - Templates Tab

struct TemplatesTab: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.templatePath) {
            TemplateListView()
                .ignoresForeignKeyboardInset()
                .navigationDestination(for: TemplateDestination.self) { destination in
                    switch destination {
                    case .details(let templateId):
                        TemplateDetailsView(templateId: templateId)
                            .accessibilityIdentifier("templateDetailsRoot")
                            .ignoresForeignKeyboardInset()
                    }
                }
        }
    }
}
