import SwiftUI

enum UITestLaunchScenario {
    case budgetLongPressWithTransactions
    case budgetLongPressEmpty
    case budgetGoalSpreadMetadata
    case savingsGoalForm
    case savingsGoalFormInvalidInterval
    case savingsGoalDetailNameOnly
    case savingsGoalDetailTargetOnly
    case savingsGoalDetailDeadlineOnly
    case savingsGoalDetailFull
    case savingsGoalDeadlineReconciliation
    case savingsGoalTemplateLines
    case contextualCreationHome
    case contextualCreationBudget

    private static let longPressWithTransactionsKey = "UITEST_BUDGET_LONG_PRESS_WITH_TRANSACTIONS"
    private static let longPressEmptyKey = "UITEST_BUDGET_LONG_PRESS_EMPTY"
    private static let budgetGoalSpreadMetadataKey = "UITEST_BUDGET_GOAL_SPREAD_METADATA"
    private static let savingsGoalFormKey = "UITEST_SAVINGS_GOAL_FORM"
    private static let savingsGoalFormInvalidIntervalKey = "UITEST_SAVINGS_GOAL_FORM_INVALID_INTERVAL"
    private static let savingsGoalDetailNameOnlyKey = "UITEST_SAVINGS_GOAL_DETAIL_NAME_ONLY"
    private static let savingsGoalDetailTargetOnlyKey = "UITEST_SAVINGS_GOAL_DETAIL_TARGET_ONLY"
    private static let savingsGoalDetailDeadlineOnlyKey = "UITEST_SAVINGS_GOAL_DETAIL_DEADLINE_ONLY"
    private static let savingsGoalDetailFullKey = "UITEST_SAVINGS_GOAL_DETAIL_FULL"
    private static let savingsGoalDeadlineReconciliationKey = "UITEST_SAVINGS_GOAL_DEADLINE_RECONCILIATION"
    private static let savingsGoalTemplateLinesKey = "UITEST_SAVINGS_GOAL_TEMPLATE_LINES"
    private static let contextualCreationHomeKey = "UITEST_CONTEXTUAL_CREATION_HOME"
    private static let contextualCreationBudgetKey = "UITEST_CONTEXTUAL_CREATION_BUDGET"
    private static let scenarioEnvironmentKey = "UITEST_SCENARIO"

    static var current: Self? {
        let processInfo = ProcessInfo.processInfo

        if let scenario = processInfo.environment[scenarioEnvironmentKey],
           let resolved = match(scenario) {
            return resolved
        }

        // Argv may carry the key as-is (UI test runner) or dash-prefixed (simctl
        // launch passes `-FOO` directly, which keeps the dash in argv). Try both.
        for argument in processInfo.arguments {
            let normalized = argument.hasPrefix("-") ? String(argument.dropFirst()) : argument
            if let resolved = match(normalized) {
                return resolved
            }
        }

        return nil
    }

    private static func match(_ key: String) -> Self? {
        [
            longPressWithTransactionsKey: .budgetLongPressWithTransactions,
            longPressEmptyKey: .budgetLongPressEmpty,
            budgetGoalSpreadMetadataKey: .budgetGoalSpreadMetadata,
            savingsGoalFormKey: .savingsGoalForm,
            savingsGoalFormInvalidIntervalKey: .savingsGoalFormInvalidInterval,
            savingsGoalDetailNameOnlyKey: .savingsGoalDetailNameOnly,
            savingsGoalDetailTargetOnlyKey: .savingsGoalDetailTargetOnly,
            savingsGoalDetailDeadlineOnlyKey: .savingsGoalDetailDeadlineOnly,
            savingsGoalDetailFullKey: .savingsGoalDetailFull,
            savingsGoalDeadlineReconciliationKey: .savingsGoalDeadlineReconciliation,
            savingsGoalTemplateLinesKey: .savingsGoalTemplateLines,
            contextualCreationHomeKey: .contextualCreationHome,
            contextualCreationBudgetKey: .contextualCreationBudget,
        ][key]
    }

    /// Stable filename written into the app sandbox by the UI test harness.
    var captureName: String {
        switch self {
        case .budgetLongPressWithTransactions: "long-press-with-transactions"
        case .budgetLongPressEmpty: "long-press-empty"
        case .budgetGoalSpreadMetadata: "budget-goal-spread-metadata"
        case .savingsGoalForm: "savings-goal-form"
        case .savingsGoalFormInvalidInterval: "savings-goal-form-invalid-interval"
        case .savingsGoalDetailNameOnly: "savings-goal-detail-name-only"
        case .savingsGoalDetailTargetOnly: "savings-goal-detail-target-only"
        case .savingsGoalDetailDeadlineOnly: "savings-goal-detail-deadline-only"
        case .savingsGoalDetailFull: "savings-goal-detail-full"
        case .savingsGoalDeadlineReconciliation: "savings-goal-deadline-reconciliation"
        case .savingsGoalTemplateLines: "savings-goal-template-lines"
        case .contextualCreationHome: "contextual-creation-home"
        case .contextualCreationBudget: "contextual-creation-budget"
        }
    }
}

@MainActor
private final class BudgetGoalSpreadUITestService: BudgetServicing, BudgetLineServicing, TagServicing {
    private let details: BudgetDetails
    private let budgets: [BudgetSparse]
    private let spreadGroupId: String
    private let occurrences: [SpreadOccurrence]

    init(details: BudgetDetails, budgets: [BudgetSparse], spreadGroupId: String, occurrences: [SpreadOccurrence]) {
        self.details = details
        self.budgets = budgets
        self.spreadGroupId = spreadGroupId
        self.occurrences = occurrences
    }

    func getBudgetWithDetails(id: String) async throws -> BudgetDetails {
        guard id == details.budget.id else { throw URLError(.badServerResponse) }
        return details
    }

    func getBudgetsSparse(fields _: String, limit _: Int?, year _: Int?) async throws -> [BudgetSparse] {
        budgets
    }

    func getSpreadOccurrences(spreadGroupId: String) async throws -> [SpreadOccurrence] {
        guard spreadGroupId == self.spreadGroupId else { throw URLError(.badServerResponse) }
        return occurrences
    }

    func getAll() async throws -> [Tag] { [] }
    func create(_: TagCreate) async throws -> Tag { throw URLError(.unsupportedURL) }
    func deleteBudgetLine(id _: String) async throws { throw URLError(.unsupportedURL) }
    func toggleCheck(id _: String) async throws -> BudgetLine { throw URLError(.unsupportedURL) }
    func postpone(id _: String) async throws -> BudgetLine { throw URLError(.unsupportedURL) }
    func createSpread(_: BudgetLineSpreadCreate) async throws -> BudgetLineSpreadResponse {
        throw URLError(.unsupportedURL)
    }

    func createSavingsWithdrawal(_: SavingsWithdrawalCreate) async throws -> SavingsWithdrawalResponse {
        throw URLError(.unsupportedURL)
    }

    func deleteSavingsWithdrawal(groupId _: String, scope _: SavingsWithdrawalDeleteScope) async throws {
        throw URLError(.unsupportedURL)
    }

    func spreadExistingBudgetLine(
        id _: String,
        periods _: [SpreadFromExistingPeriod]
    ) async throws -> BudgetLineSpreadResponse {
        throw URLError(.unsupportedURL)
    }
}

struct BudgetGoalSpreadUITestHarness: View {
    private static let budgetId = "goal-spread-budget"
    private static let lineId = "goal-spread-line"
    private static let goalId = "ui-test-goal"
    // The UUID is the source of truth and the string derives from it. Going the
    // other way needs the failable `UUID(uuidString:)`, whose `nil` on a
    // mistyped literal silently strips the line's spread group — and it lets the
    // literal's casing drift from the uppercase `uuidString` the route carries,
    // which the service compares against.
    private static let spreadGroupId = UUID()
    private static var spreadGroupIdString: String { spreadGroupId.uuidString }

    private let routeService: BudgetGoalSpreadUITestService
    private let savingsGoalService: SavingsGoalIntervalUITestService
    @State private var appState: AppState
    @State private var savingsGoalStore: SavingsGoalStore
    @State private var userSettingsStore = UserSettingsStore()
    @State private var currentMonthStore = CurrentMonthStore()
    @State private var budgetListStore: BudgetListStore
    @State private var dashboardStore = DashboardStore()
    @State private var tagStore: TagStore

    init() {
        let appState = AppState()
        // This harness shows the budgets branch alone; `pushOnActiveStack` routes by
        // `selectedTab`, so the default `.currentMonth` would push onto a stack
        // nobody is looking at and every tap-to-detail would silently do nothing.
        appState.selectedTab = .budgets
        let savingsGoalService = SavingsGoalIntervalUITestService(scenario: .budgetGoalSpreadMetadata)
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let seed = Self.seed(now: now)
        let sparse = BudgetSparse(from: seed.budget)
        let routeService = BudgetGoalSpreadUITestService(
            details: BudgetDetails(budget: seed.budget, transactions: [], budgetLines: [seed.line]),
            budgets: [sparse],
            spreadGroupId: Self.spreadGroupIdString,
            occurrences: [
                Self.occurrence(
                    budgetLineId: "goal-spread-july", budgetId: "goal-spread-july-budget", month: 7, amount: 137
                ),
                Self.occurrence(budgetLineId: Self.lineId, budgetId: Self.budgetId, month: 8, amount: 413),
            ]
        )
        ProductTips.tourDismissed = true

        BudgetDetailCache.shared.store(
            budgetId: Self.budgetId,
            budget: seed.budget,
            budgetLines: [seed.line],
            transactions: []
        )
        BudgetDetailCache.shared.storeAllBudgets([sparse])

        self.routeService = routeService
        self.savingsGoalService = savingsGoalService
        _appState = State(initialValue: appState)
        _budgetListStore = State(
            initialValue: BudgetListStore(budgetService: routeService, initialBudgets: [sparse])
        )
        _savingsGoalStore = State(initialValue: SavingsGoalStore(service: savingsGoalService))
        _tagStore = State(initialValue: TagStore(service: routeService))
    }

    private static func occurrence(
        budgetLineId: String, budgetId: String, month: Int, amount: Decimal
    ) -> SpreadOccurrence {
        SpreadOccurrence(
            budgetLineId: budgetLineId, budgetId: budgetId, month: month, year: 2026,
            name: "Voyage au Japon", amount: amount, kind: .saving, checkedAt: nil,
            originalAmount: nil, consumed: 0, transactionCount: 0
        )
    }

    private static func seed(now: Date) -> (budget: Budget, line: BudgetLine) {
        var line = BudgetLine(
            id: Self.lineId,
            budgetId: Self.budgetId,
            templateLineId: nil,
            savingsGoalId: Self.goalId,
            name: "Voyage au Japon",
            amount: 413,
            kind: .saving,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: now,
            updatedAt: now
        )
        line.spreadGroupId = Self.spreadGroupId
        let budget = Budget(
            id: Self.budgetId,
            month: 8,
            year: 2026,
            description: "Août 2026",
            userId: "ui-test",
            templateId: "ui-test-template",
            endingBalance: nil,
            rollover: nil,
            remaining: 413,
            previousBudgetId: nil,
            createdAt: now,
            updatedAt: now
        )
        return (budget, line)
    }

    var body: some View {
        BudgetsTab(
            budgetService: routeService,
            budgetLineService: routeService,
            savingsGoalService: savingsGoalService
        )
        .environment(\.dynamicTypeSize, dynamicTypeSize)
        .preferredColorScheme(preferredColorScheme)
        .environment(appState)
        .environment(userSettingsStore)
        .environment(currentMonthStore)
        .environment(budgetListStore)
        .environment(dashboardStore)
        .environment(savingsGoalStore)
        .environment(tagStore)
        .environment(appState.toastManager)
        .task {
            await savingsGoalStore.forceRefresh()
        }
    }

    private var dynamicTypeSize: DynamicTypeSize {
        ProcessInfo.processInfo.environment["UITEST_DYNAMIC_TYPE"] == "accessibility3"
            ? .accessibility3
            : .large
    }

    private var preferredColorScheme: ColorScheme {
        ProcessInfo.processInfo.environment["UITEST_COLOR_SCHEME"] == "dark"
            ? .dark
            : .light
    }
}

struct BudgetLongPressUITestHarness: View {
    let scenario: UITestLaunchScenario
    @State private var linkedTransactionsContext: LinkedTransactionsContext?
    @State private var userSettingsStore = UserSettingsStore()

    private let budgetId = "budget-ui-test"
    private var now: Date { Date() }

    private var budgetLine: BudgetLine {
        switch scenario {
        case .budgetLongPressWithTransactions:
            BudgetLine(
                id: "with-transactions",
                budgetId: budgetId,
                templateLineId: nil,
                savingsGoalId: nil,
                name: "Prévision avec mouvements",
                amount: 250,
                kind: .expense,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: nil,
                createdAt: now,
                updatedAt: now
            )
        case .budgetLongPressEmpty:
            BudgetLine(
                id: "empty",
                budgetId: budgetId,
                templateLineId: nil,
                savingsGoalId: nil,
                name: "Prévision simple",
                amount: 200,
                kind: .expense,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: nil,
                createdAt: now,
                updatedAt: now
            )
        default:
            preconditionFailure("BudgetLongPressUITestHarness requires a budget scenario")
        }
    }

    private var transactions: [Transaction] {
        switch scenario {
        case .budgetLongPressWithTransactions:
            [
                Transaction(
                    id: "tx-with-linked",
                    budgetId: budgetId,
                    budgetLineId: "with-transactions",
                    name: "Dépense liée",
                    amount: 42,
                    kind: .expense,
                    transactionDate: now,
                    category: nil,
                    checkedAt: nil,
                    createdAt: now,
                    updatedAt: now
                ),
            ]
        case .budgetLongPressEmpty:
            []
        default:
            preconditionFailure("BudgetLongPressUITestHarness requires a budget scenario")
        }
    }

    var body: some View {
        NavigationStack {
            List {
                BudgetSection(
                    title: "UI Test",
                    items: [budgetLine],
                    transactions: transactions,
                    syncingIds: [],
                    onToggle: { _ in },
                    onDelete: { _ in },
                    onAddTransaction: { _ in },
                    onLongPress: { line, linkedTransactions in
                        linkedTransactionsContext = LinkedTransactionsContext(
                            budgetLine: line,
                            transactions: linkedTransactions
                        )
                    },
                    onEdit: { _ in }
                )
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Long Press")
        }
        .sheet(item: $linkedTransactionsContext) { context in
            LinkedTransactionsSheet(
                budgetLine: context.budgetLine,
                transactions: context.transactions,
                onToggle: { _ in },
                onEdit: { _ in },
                onDelete: { _ in },
                onAddTransaction: {}
            )
        }
        .environment(userSettingsStore)
    }
}
