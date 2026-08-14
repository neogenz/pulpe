import Foundation
import SwiftUI

@MainActor
@Observable
final class SavingsGoalIntervalUITestService: SavingsGoalServicing {
    private(set) var goals: [SavingsGoal]
    private(set) var createCallCount = 0
    private(set) var updateCallCount = 0
    private(set) var lastReconciliationMode: SavingsGoalGenerationStopMode?

    private let scenario: UITestLaunchScenario

    init(scenario: UITestLaunchScenario) {
        self.scenario = scenario
        goals = Self.initialGoals(for: scenario)
    }

    func getAll() async throws -> [SavingsGoal] {
        goals
    }

    func get(id: String) async throws -> SavingsGoal {
        try goal(id)
    }

    func getProgress(id: String) async throws -> SavingsGoalProgress {
        let goal = try goal(id)
        if scenario == .budgetGoalSpreadMetadata {
            return Self.budgetGoalSpreadProgress(goal: goal)
        }
        let hasTarget = goal.targetAmount != nil
        let hasDeadline = goal.targetDate != nil
        let hasPlan = hasTarget
        return SavingsGoalProgress(
            goalId: id,
            status: goal.status,
            startDate: goal.startDate,
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate,
            plannedCumulative: 1_200,
            plannedProjection: 3_600,
            confirmed: 600,
            initialAmount: goal.initialAmount ?? 0,
            achievementPercent: hasTarget
                ? (scenario == .savingsGoalDetailTargetOnly ? 120 : 20)
                : nil,
            monthsElapsed: 3,
            monthsRemaining: hasDeadline ? 12 : nil,
            isOverdue: false,
            pace: 300,
            confirmedPace: 225,
            required: hasTarget && hasDeadline ? 300 : nil,
            projected: hasTarget && hasDeadline ? 3_600 : nil,
            paceStatus: hasTarget && hasDeadline ? .onTrack : nil,
            suggestCompletion: hasTarget
                ? scenario == .savingsGoalDetailTargetOnly
                : nil,
            linkedLineCount: hasPlan ? 1 : 0,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: hasPlan ? Self.planMonths : [],
            cumulativeGap: hasPlan ? 600 : 0,
            estimatedCompletion: hasTarget ? BudgetPeriod(month: 6, year: 2027) : nil
        )
    }

    func getContributions(id _: String) async throws -> [SavingsGoalContribution] {
        []
    }

    func applyPlan(
        id _: String,
        _ payload: SavingsGoalPlanApply
    ) async throws -> SavingsGoalPlanApplyResult {
        SavingsGoalPlanApplyResult(updatedLines: [])
    }

    func getFutureLines(
        id _: String,
        targetDate: String?
    ) async throws -> [SavingsGoalFutureLine] {
        guard scenario == .savingsGoalDeadlineReconciliation, targetDate != nil else { return [] }
        return [
            SavingsGoalFutureLine(budgetLineId: "future-1", amount: 200, month: 7, year: 2027),
            SavingsGoalFutureLine(budgetLineId: "future-2", amount: 200, month: 8, year: 2027),
        ]
    }

    func applyGenerationStop(
        id _: String,
        _ payload: SavingsGoalGenerationStop
    ) async throws -> SavingsGoalGenerationStopResult {
        lastReconciliationMode = payload.mode
        return SavingsGoalGenerationStopResult(affectedCount: payload.budgetLineIds.count)
    }

    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        createCallCount += 1
        let created = SavingsGoal(
            id: "created-\(createCallCount)",
            userId: "ui-test",
            name: data.name,
            targetAmount: data.targetAmount,
            targetDate: data.targetDate,
            status: data.status,
            createdAt: Self.now,
            updatedAt: Self.now,
            startDate: data.startDate,
            initialAmount: data.initialAmount
        )
        goals.append(created)
        return created
    }

    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        updateCallCount += 1
        lastReconciliationMode = data.reconciliation?.mode
        let existing = try goal(id)
        let updated = SavingsGoal(
            id: existing.id,
            userId: existing.userId,
            name: data.name ?? existing.name,
            targetAmount: data.targetAmount ?? existing.targetAmount,
            targetDate: data.targetDate ?? existing.targetDate,
            status: data.status ?? existing.status,
            createdAt: existing.createdAt,
            updatedAt: Self.now,
            startDate: data.startDate ?? existing.startDate,
            initialAmount: data.initialAmount ?? existing.initialAmount
        )
        if let index = goals.firstIndex(where: { $0.id == id }) {
            goals[index] = updated
        }
        return updated
    }

    func getDeletionImpact(id: String) async throws -> SavingsGoalDeletionImpact {
        SavingsGoalDeletionImpact(
            goalId: id,
            summary: SavingsGoalDeletionSummary(
                templateLineCount: 0,
                templateLineTotal: 0,
                budgetCount: 0,
                budgetLineCount: 0,
                budgetLineTotal: 0,
                transactionCount: 0,
                transactionTotal: 0,
                withdrawalCount: 0,
                withdrawalTotal: 0
            ),
            templateLines: [],
            budgets: [],
            withdrawals: [],
            revision: SavingsGoalDeletionRevision(
                templateLines: [],
                budgetLines: [],
                transactions: []
            )
        )
    }

    func delete(id: String, command _: SavingsGoalDeletionCommand) async throws {
        goals.removeAll { $0.id == id }
    }

    func getWithdrawalOptions() async throws -> [SavingsGoalWithdrawalOption] {
        []
    }

    func getWithdrawals(id _: String) async throws -> SavingsGoalWithdrawalsReadModel {
        SavingsGoalWithdrawalsReadModel(withdrawals: [])
    }

    private func goal(_ id: String) throws -> SavingsGoal {
        guard let goal = goals.first(where: { $0.id == id }) else {
            throw URLError(.badServerResponse)
        }
        return goal
    }

    private static let now = Date(timeIntervalSince1970: 1_700_000_000)

    private static func budgetGoalSpreadProgress(goal: SavingsGoal) -> SavingsGoalProgress {
        let planMonth = SavingsGoalPlanMonth(
            month: 8,
            year: 2026,
            state: .current,
            isLocked: false,
            plannedAmount: 413,
            confirmedAmount: 0,
            plannedCumulative: 413,
            confirmedCumulative: 300,
            lines: [
                SavingsGoalPlanLine(
                    budgetLineId: "goal-spread-line",
                    amount: 413,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
        return SavingsGoalProgress(
            goalId: goal.id,
            status: goal.status,
            startDate: goal.startDate,
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate,
            plannedCumulative: 413,
            plannedProjection: 713,
            confirmed: 300,
            initialAmount: goal.initialAmount ?? 0,
            achievementPercent: nil,
            monthsElapsed: 1,
            monthsRemaining: nil,
            isOverdue: false,
            pace: 413,
            confirmedPace: 300,
            required: nil,
            projected: nil,
            paceStatus: nil,
            suggestCompletion: nil,
            linkedLineCount: 1,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: [planMonth],
            cumulativeGap: 113,
            estimatedCompletion: nil
        )
    }

    private static let planMonths = [
        planMonth(month: 5, state: .past, isLocked: true, isChecked: true),
        planMonth(month: 6, state: .current, isLocked: false, isChecked: false),
        planMonth(month: 7, state: .future, isLocked: false, isChecked: false),
    ]

    private static func planMonth(
        month: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool,
        isChecked: Bool
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2027,
            state: state,
            isLocked: isLocked,
            plannedAmount: 300,
            confirmedAmount: isChecked ? 300 : 0,
            plannedCumulative: Decimal(month - 3) * 300,
            confirmedCumulative: 600,
            lines: [
                SavingsGoalPlanLine(
                    budgetLineId: "plan-\(month)",
                    amount: 300,
                    checkedAt: isChecked ? "2027-05-15T00:00:00Z" : nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
    }

    private static func initialGoals(for scenario: UITestLaunchScenario) -> [SavingsGoal] {
        let targetAmount: Decimal?
        let targetDate: String?
        let startDate: String?

        switch scenario {
        case .savingsGoalDetailTargetOnly:
            targetAmount = 500
            targetDate = nil
            startDate = nil
        case .savingsGoalDetailDeadlineOnly:
            targetAmount = nil
            targetDate = "2027-08-15"
            startDate = nil
        case .savingsGoalDetailFull, .savingsGoalDeadlineReconciliation:
            targetAmount = 3_000
            targetDate = "2027-08-15"
            startDate = "2026-08-15"
        case .savingsGoalFormInvalidInterval:
            targetAmount = 3_000
            targetDate = "2027-08-15"
            startDate = "2027-09-15"
        default:
            targetAmount = nil
            targetDate = nil
            startDate = nil
        }

        return [
            SavingsGoal(
                id: "ui-test-goal",
                userId: "ui-test",
                name: "Voyage au Japon",
                targetAmount: targetAmount,
                targetDate: targetDate,
                status: .active,
                createdAt: now,
                updatedAt: now,
                startDate: startDate,
                initialAmount: 300
            ),
        ]
    }
}

struct SavingsGoalIntervalUITestHarness: View {
    let scenario: UITestLaunchScenario

    @State private var service: SavingsGoalIntervalUITestService
    @State private var store: SavingsGoalStore
    @State private var userSettingsStore = UserSettingsStore()
    @State private var toastManager = ToastManager()
    @State private var currentMonthStore = CurrentMonthStore()
    @State private var budgetListStore = BudgetListStore()
    @State private var dashboardStore = DashboardStore()
    // SavingsGoalDetailView reads AppState (budget navigation); without this
    // injection every DETAIL_* scenario traps on the environment lookup.
    @State private var appState = AppState()

    init(scenario: UITestLaunchScenario) {
        self.scenario = scenario
        let service = SavingsGoalIntervalUITestService(scenario: scenario)
        _service = State(initialValue: service)
        _store = State(initialValue: SavingsGoalStore(service: service))
    }

    var body: some View {
        content
            .environment(\.dynamicTypeSize, dynamicTypeSize)
            .preferredColorScheme(preferredColorScheme)
            .environment(appState)
            .environment(store)
            .environment(userSettingsStore)
            .environment(toastManager)
            .environment(currentMonthStore)
            .environment(budgetListStore)
            .environment(dashboardStore)
            .overlay(alignment: .bottomTrailing) {
                stateProbes
            }
            .task {
                await store.forceRefresh()
            }
    }

    private var dynamicTypeSize: DynamicTypeSize {
        ProcessInfo.processInfo.environment["UITEST_DYNAMIC_TYPE"] == "accessibility3"
            ? .accessibility3
            : .large
    }

    private var preferredColorScheme: ColorScheme? {
        ProcessInfo.processInfo.environment["UITEST_COLOR_SCHEME"] == "dark"
            ? .dark
            : nil
    }

    @ViewBuilder
    private var content: some View {
        switch scenario {
        case .savingsGoalForm:
            SavingsGoalFormSheet(goal: nil, userCurrency: .chf)
        case .savingsGoalFormInvalidInterval:
            SavingsGoalFormSheet(
                goal: service.goals[0],
                userCurrency: .chf,
                onUpdate: { update in
                    Task { _ = try? await service.update(id: "ui-test-goal", data: update) }
                }
            )
        case .savingsGoalDetailNameOnly,
             .savingsGoalDetailTargetOnly,
             .savingsGoalDetailDeadlineOnly,
             .savingsGoalDetailFull,
             .savingsGoalDeadlineReconciliation:
            NavigationStack {
                SavingsGoalDetailView(goal: service.goals[0], service: service)
            }
        case .savingsGoalTemplateLines:
            NavigationStack {
                List {
                    TemplateLineRow(
                        line: templateLine(id: "linked-line", savingsGoalId: "ui-test-goal"),
                        tagNamesById: [:]
                    ) {}
                    TemplateLineRow(
                        line: templateLine(id: "free-line", savingsGoalId: nil),
                        tagNamesById: [:]
                    ) {}
                }
                .navigationTitle("Mois Type")
            }
        case .budgetLongPressWithTransactions,
             .budgetLongPressEmpty,
             .budgetGoalSpreadMetadata,
             .contextualCreationHome,
             .contextualCreationBudget,
             .loginScreen:
            EmptyView()
        }
    }

    private var stateProbes: some View {
        VStack {
            Text("\(service.createCallCount)")
                .accessibilityIdentifier("savingsGoalUITestCreateCount")
            Text("\(service.updateCallCount)")
                .accessibilityIdentifier("savingsGoalUITestUpdateCount")
            Text(service.lastReconciliationMode?.rawValue ?? "none")
                .accessibilityIdentifier("savingsGoalUITestReconciliationMode")
            Text(service.goals.last?.name ?? "none")
                .accessibilityIdentifier("savingsGoalUITestLastGoalName")
        }
        .font(.system(size: 1))
        .frame(width: 1, height: 1)
        .clipped()
    }

    private func templateLine(id: String, savingsGoalId: String?) -> TemplateLine {
        TemplateLine(
            id: id,
            templateId: "ui-test-template",
            name: savingsGoalId == nil ? "Épargne libre" : "Épargne voyage",
            amount: 200,
            kind: .saving,
            recurrence: .fixed,
            description: "",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000),
            savingsGoalId: savingsGoalId
        )
    }
}
