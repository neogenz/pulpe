import Foundation
@testable import Pulpe
import Testing

@MainActor
struct SavingsGoalDetailViewModelTests {
    private func makeGoal(
        id: String,
        status: SavingsGoalStatus = .active
    ) -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: "Maison",
            targetAmount: 50000,
            targetDate: "2099-01-01",
            status: status,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func makeProgress(
        goalId: String = "g1",
        status: SavingsGoalStatus = .active,
        suggestCompletion: Bool = false,
        linkedLineCount: Int = 2
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: goalId,
            status: status,
            targetAmount: 50000,
            targetDate: "2099-01-01",
            plannedCumulative: 12000,
            confirmed: 9000,
            achievementPercent: 18,
            monthsElapsed: 6,
            monthsRemaining: 18,
            isOverdue: false,
            pace: 2000,
            confirmedPace: 1500,
            required: 2277.78,
            projected: 36000,
            paceStatus: .behind,
            suggestCompletion: suggestCompletion,
            linkedLineCount: linkedLineCount,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil
        )
    }

    @Test("detail starts loading instead of rendering an empty screen")
    func initialState_isLoading() {
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: MockSavingsGoalService())

        #expect(viewModel.isLoading)
        #expect(viewModel.progress == nil)
        #expect(viewModel.error == nil)
    }

    @Test("load fetches progress from the service")
    func load_fetchesProgress() async {
        let service = MockSavingsGoalService()
        service.stubbedProgress = makeProgress(goalId: "g1")
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        await viewModel.load()

        #expect(viewModel.progress?.goalId == "g1")
        #expect(viewModel.error == nil)
        #expect(service.getProgressCallCount == 1)
        #expect(service.getContributionsCallCount == 1)
    }

    @Test("load fetches linked forecasts and their real transactions")
    func load_fetchesContributions() async {
        let service = MockSavingsGoalService()
        service.stubbedProgress = makeProgress(goalId: "g1")
        service.stubbedContributions = [makeContribution()]
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.contributions.map(\.lineId) == ["line-1"])
        #expect(viewModel.contributions.first?.transactions.map(\.id) == ["tx-1"])
        #expect(viewModel.contributionsError == nil)
    }

    @Test("a contributions failure keeps the goal progress usable")
    func load_contributionsFailureIsInline() async {
        let service = MockSavingsGoalService()
        service.stubbedProgress = makeProgress(goalId: "g1")
        service.getContributionsError = APIError.networkError(URLError(.timedOut))
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.progress != nil)
        #expect(viewModel.error == nil)
        #expect(viewModel.contributionsError != nil)
    }

    @Test("changeStatus updates via the store then refetches progress (D2 path)")
    func changeStatus_updatesAndRefetches() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        service.stubbedProgress = makeProgress(goalId: "g1", suggestCompletion: true)
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        await viewModel.load()

        await viewModel.changeStatus(to: .completed, via: store)

        #expect(service.updateCallCount == 1)
        let updated = store.goals.first { $0.id == "g1" }
        #expect(updated?.status == .completed)
        #expect(service.getProgressCallCount == 2, "progress is refetched after a status change")
        #expect(viewModel.error == nil)
    }

    @Test("load surfaces a service error and leaves progress nil")
    func load_surfacesError() async {
        let service = MockSavingsGoalService()
        service.error = APIError.networkError(URLError(.notConnectedToInternet))
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.progress == nil)
        #expect(viewModel.error != nil)
    }

    @Test("changeStatus surfaces a store error without refetching")
    func changeStatus_surfacesStoreError() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        service.error = APIError.networkError(URLError(.timedOut))

        await viewModel.changeStatus(to: .completed, via: store)

        #expect(viewModel.error != nil)
        #expect(service.getProgressCallCount == 0, "no refetch when the status update fails")
    }

    @Test("changeStatus stays successful when only the progress refetch fails")
    func changeStatus_refetchFailure_doesNotReportMutationFailure() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        service.getProgressError = APIError.networkError(URLError(.timedOut))

        await viewModel.changeStatus(to: .completed, via: store)

        #expect(store.goals.first?.status == .completed)
        #expect(service.getProgressCallCount == 1)
        #expect(viewModel.error == nil, "a failed refresh must not turn a persisted status change into an error")
    }

    private func makeContribution() -> SavingsGoalContribution {
        SavingsGoalContribution(
            lineId: "line-1",
            name: "Épargne maison",
            amount: 500,
            checkedAt: nil,
            budgetMonth: 7,
            budgetYear: 2026,
            transactions: [
                Transaction(
                    id: "tx-1",
                    budgetId: "budget-1",
                    budgetLineId: "line-1",
                    name: "Virement épargne",
                    amount: 500,
                    kind: .saving,
                    transactionDate: Date(timeIntervalSince1970: 0),
                    category: nil,
                    checkedAt: Date(timeIntervalSince1970: 0),
                    createdAt: Date(timeIntervalSince1970: 0),
                    updatedAt: Date(timeIntervalSince1970: 0)
                ),
            ]
        )
    }
}

@MainActor
struct GoalPlanSimulatorViewModelTests {
    private func makeGoal() -> SavingsGoal {
        SavingsGoal(
            id: "g1",
            userId: "user-1",
            name: "Maison",
            targetAmount: 1_000,
            targetDate: "2099-03-01",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func makeMonth(
        month: Int,
        planned: Decimal,
        isProvisionable: Bool = false
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2099,
            state: isProvisionable ? .gap : .future,
            isLocked: false,
            isProvisionable: isProvisionable,
            plannedAmount: planned,
            confirmedAmount: 0,
            plannedCumulative: planned,
            confirmedCumulative: 0,
            lines: isProvisionable ? [] : [
                SavingsGoalPlanLine(
                    budgetLineId: "line-\(month)",
                    amount: planned,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
    }

    private func makeProgress(
        months: [SavingsGoalPlanMonth]? = nil,
        initialAmount: Decimal = 0
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: 1_000,
            targetDate: "2099-03-01",
            plannedCumulative: 600,
            confirmed: 0,
            initialAmount: initialAmount,
            achievementPercent: 0,
            monthsElapsed: 0,
            monthsRemaining: 3,
            isOverdue: false,
            pace: 200,
            confirmedPace: 0,
            required: 333.34,
            projected: 600,
            paceStatus: .behind,
            suggestCompletion: false,
            linkedLineCount: 3,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months ?? [
                makeMonth(month: 1, planned: 100),
                makeMonth(month: 2, planned: 200),
                makeMonth(month: 3, planned: 300),
            ]
        )
    }

    private func makeViewModel(
        progress: SavingsGoalProgress? = nil,
        service: MockSavingsGoalService = MockSavingsGoalService()
    ) -> GoalPlanSimulatorViewModel {
        GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress ?? makeProgress(),
            currency: .chf,
            payDay: 1,
            service: service
        )
    }

    @Test("opens on the current plan without pending changes")
    func init_usesBaseline() {
        let viewModel = makeViewModel()

        #expect(viewModel.planChanges.isEmpty)
        #expect(viewModel.isDirty == false)
        #expect(viewModel.canApply == false)
    }

    @Test("a monthly override keeps the global amount as the baseline for every other month")
    func setMonth_preservesGlobalBaseline() {
        let viewModel = makeViewModel()
        let overriddenKey = 2099 * 12 + 2

        viewModel.setGlobalAmount(250)
        viewModel.setMonth(key: overriddenKey, amount: 400)

        #expect(viewModel.globalAmount == 250)
        #expect(viewModel.sliderValue == 250)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 1) == 250)
        #expect(viewModel.simulatedAmount(forKey: overriddenKey) == 400)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 3) == 250)
        #expect(viewModel.hasVariableMonthlyAmounts)
    }

    @Test("a new global gesture replaces every monthly override")
    func setGlobalAmount_clearsOverrides() {
        let viewModel = makeViewModel()
        let overriddenKey = 2099 * 12 + 2
        viewModel.setGlobalAmount(250)
        viewModel.setMonth(key: overriddenKey, amount: 400)

        viewModel.setGlobalAmount(300)

        #expect(viewModel.overrides.isEmpty)
        #expect(viewModel.globalAmount == 300)
        #expect(viewModel.draft.months.allSatisfy { $0.simulatedAmount == 300 })
    }

    @Test("apply sends provisionable gaps by period and materialized months by line")
    func apply_splitsMissingPeriodsFromMaterializedLines() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(months: [
            makeMonth(month: 1, planned: 100),
            makeMonth(month: 2, planned: 200),
            makeMonth(month: 3, planned: 0, isProvisionable: true),
        ])
        let viewModel = makeViewModel(progress: progress, service: service)
        viewModel.setGlobalAmount(250)

        #expect(viewModel.planChanges.count == 3)
        #expect(viewModel.planChanges.filter { $0.month.isProvisionable }.count == 1)

        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.count == 2)
        #expect(payload.missingMonthAdjustments.count == 1)
        #expect(payload.missingMonthAdjustments.first?.month == 3)
        #expect(payload.missingMonthAdjustments.first?.year == 2099)
        #expect(payload.missingMonthAdjustments.first?.amount == 250)
    }

    @Test("revert clears changes and the discard-warning state")
    func revert_restoresCleanBaseline() {
        let viewModel = makeViewModel()
        viewModel.setGlobalAmount(250)

        viewModel.revert()

        #expect(viewModel.planChanges.isEmpty)
        #expect(viewModel.isDirty == false)
        #expect(viewModel.canApply == false)
    }

    @Test("an initial amount seeds the simulated cumulative, changing the verdict")
    func initialAmount_seedsSimulatedFinalAndVerdict() {
        let withoutSeed = makeViewModel()
        let withSeed = makeViewModel(progress: makeProgress(initialAmount: 400))

        #expect(withoutSeed.draft.simulatedFinal == 600)
        #expect(withoutSeed.draft.attainedPeriod == nil)

        #expect(withSeed.draft.simulatedFinal == 1_000)
        #expect(withSeed.draft.attainedPeriod == BudgetPeriod(month: 3, year: 2099))
        #expect(withSeed.verdictText != withoutSeed.verdictText)
    }

    @Test("redistribution preserves a manually adjusted month")
    func redistribute_preservesPinnedMonth() {
        let viewModel = makeViewModel()
        let pinnedKey = 2099 * 12 + 1
        viewModel.setMonth(key: pinnedKey, amount: 400)

        viewModel.redistribute()

        #expect(viewModel.simulatedAmount(forKey: pinnedKey) == 400)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 2) == 300)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 3) == 300)
    }

    @Test("cents-exact redistribution exposes a variable monthly state")
    func redistribute_exposesVariableState() {
        let viewModel = makeViewModel()

        viewModel.redistribute()

        #expect(viewModel.hasVariableMonthlyAmounts)
        #expect(viewModel.globalAmount == nil)
    }
}

@MainActor
struct SavingsGoalGenerationStopViewModelTests {
    @Test("loadFutureLines exposes the advisory candidates")
    func loadFutureLines_exposesCandidates() async {
        let service = MockSavingsGoalService()
        service.stubbedFutureLines = [
            SavingsGoalFutureLine(budgetLineId: "l1", amount: 200, month: 8, year: 2099),
        ]
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.loadFutureLines()

        #expect(viewModel.futureLines.count == 1)
        #expect(viewModel.futureLines.first?.budgetLineId == "l1")
    }
}
