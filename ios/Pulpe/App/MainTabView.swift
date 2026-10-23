import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    var budgetService: any BudgetServicing = BudgetService.shared
    var budgetLineService: any BudgetLineServicing = BudgetLineService.shared
    var savingsGoalService: any SavingsGoalServicing = SavingsGoalService.shared
    var makeCreateBudgetModel: ((Int, Int) -> CreateBudgetViewModel)?
    var makePlanBudgetsModel: (() -> PlanBudgetsViewModel)?

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
                BudgetsTab(
                    budgetService: budgetService,
                    budgetLineService: budgetLineService,
                    savingsGoalService: savingsGoalService,
                    makeCreateBudgetModel: makeCreateBudgetModel, makePlanBudgetsModel: makePlanBudgetsModel
                )
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
    private let budgetService: any BudgetServicing
    private let budgetLineService: any BudgetLineServicing
    private let savingsGoalService: any SavingsGoalServicing
    private let makeCreateBudgetModel: ((Int, Int) -> CreateBudgetViewModel)?
    private let makePlanBudgetsModel: (() -> PlanBudgetsViewModel)?
    /// Shared with explicit root entries so a deep link cannot replace an open draft.
    private var router: BudgetDetailsRouter { appState.budgetRouter }

    init(
        budgetService: any BudgetServicing = BudgetService.shared,
        budgetLineService: any BudgetLineServicing = BudgetLineService.shared,
        savingsGoalService: any SavingsGoalServicing = SavingsGoalService.shared,
        makeCreateBudgetModel: ((Int, Int) -> CreateBudgetViewModel)? = nil,
        makePlanBudgetsModel: (() -> PlanBudgetsViewModel)? = nil
    ) {
        self.budgetService = budgetService
        self.budgetLineService = budgetLineService
        self.savingsGoalService = savingsGoalService
        self.makeCreateBudgetModel = makeCreateBudgetModel
        self.makePlanBudgetsModel = makePlanBudgetsModel
    }

    var body: some View {
        @Bindable var state = appState
        @Bindable var router = router

        NavigationSplitView {
            BudgetListView(makeCreateBudgetModel: makeCreateBudgetModel, makePlanBudgetsModel: makePlanBudgetsModel)
                .ignoresForeignKeyboardInset()
        } detail: {
            if let id = state.selectedBudgetId {
                NavigationStack(path: $state.budgetPath) {
                    BudgetDetailsView(
                        budgetId: id,
                        budgetService: budgetService,
                        budgetLineService: budgetLineService,
                        onBudgetChange: { id, year in
                            state.updateBudgetSelection(id, year: year)
                        }
                    )
                    .ignoresForeignKeyboardInset()
                    .navigationDestination(for: BudgetDestination.self) { destination in
                        budgetDestination(
                            destination, budgetService: budgetService, budgetLineService: budgetLineService
                        )
                    }
                    .navigationDestination(for: SavingsGoalDestination.self) { destination in
                        savingsGoalDestination(destination, service: savingsGoalService)
                    }
                }
            } else {
                ContentUnavailableView("Budgets", systemImage: "calendar", description: Text("Choisis un mois"))
                    .ignoresForeignKeyboardInset()
            }
        }
        .navigationSplitViewStyle(.balanced)
        .sheet(item: $router.sheetPresentation) { presentation in
            if let coordinator = presentation.coordinator {
                BudgetDetailSheetContent(destination: presentation.destination)
                    .environment(coordinator)
            }
        }
        .environment(router)
        .task { router.bind(to: appState) }
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
